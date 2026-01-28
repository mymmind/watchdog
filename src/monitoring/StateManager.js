/**
 * State Manager
 * Tracks service failures, implements alert cooldown, detects flapping
 * Persists state to disk for resilience across restarts
 */

import fs from 'fs';
import logger from '../utils/logger.js';

export default class StateManager {
  constructor(statePath = './state.json', config = {}) {
    this.statePath = statePath;
    this.config = config;
    this.state = {
      failures: new Map(), // serviceId -> failure info
      flapping: new Map(), // serviceId -> state transitions
      acknowledged: new Set(), // serviceId -> manually muted
      sslExpiry: new Map(), // domain -> expiry date
    };
    this.load();

    // Auto-save every 60 seconds
    this.autoSaveInterval = setInterval(() => this.save(), 60000);
  }

  /**
   * Load state from disk
   */
  load() {
    if (!fs.existsSync(this.statePath)) {
      logger.info('No existing state file, starting fresh');
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));

      // Restore Maps and Sets from JSON arrays
      this.state.failures = new Map(data.failures || []);
      this.state.flapping = new Map(data.flapping || []);
      this.state.acknowledged = new Set(data.acknowledged || []);
      this.state.sslExpiry = new Map(data.sslExpiry || []);

      logger.info('State loaded from disk', {
        failures: this.state.failures.size,
        flapping: this.state.flapping.size,
      });
    } catch (error) {
      logger.error('Failed to load state', { error: error.message });
    }
  }

  /**
   * Save state to disk
   */
  save() {
    try {
      const data = {
        failures: Array.from(this.state.failures.entries()),
        flapping: Array.from(this.state.flapping.entries()),
        acknowledged: Array.from(this.state.acknowledged),
        sslExpiry: Array.from(this.state.sslExpiry.entries()),
        lastSaved: new Date().toISOString(),
      };

      fs.writeFileSync(this.statePath, JSON.stringify(data, null, 2), 'utf8');
      logger.debug('State saved to disk');
    } catch (error) {
      logger.error('Failed to save state', { error: error.message });
    }
  }

  /**
   * Record a service failure
   * @param {string} serviceId - Unique service identifier
   * @param {string} error - Error message
   * @returns {string} - Alert action (first_failure, ongoing_failure, suppressed)
   */
  recordFailure(serviceId, error) {
    const now = Date.now();
    const existing = this.state.failures.get(serviceId);

    if (!existing) {
      // First failure - alert immediately
      this.state.failures.set(serviceId, {
        firstSeen: now,
        lastAlertSent: now,
        error,
        consecutiveFailures: 1,
      });
      return 'first_failure';
    }

    // Ongoing failure
    existing.consecutiveFailures += 1;
    existing.error = error; // Update error message
    this.state.failures.set(serviceId, existing);

    // Check if we should re-alert (cooldown period expired)
    const cooldownMs = (this.config.alerts?.cooldownMinutes || 30) * 60 * 1000;
    const minutesSinceLastAlert = (now - existing.lastAlertSent) / 1000 / 60;

    if (minutesSinceLastAlert >= (cooldownMs / 60000)) {
      existing.lastAlertSent = now;
      this.state.failures.set(serviceId, existing);
      return 'ongoing_failure';
    }

    return 'suppressed';
  }

  /**
   * Record a service recovery
   * @param {string} serviceId - Service identifier
   * @returns {Object|null} - Recovery info or null if no failure recorded
   */
  recordRecovery(serviceId) {
    const failure = this.state.failures.get(serviceId);
    if (!failure) return null;

    const downtime = Date.now() - failure.firstSeen;
    this.state.failures.delete(serviceId);

    return {
      downtimeDuration: downtime,
      failuresSeen: failure.consecutiveFailures,
      firstSeen: failure.firstSeen,
    };
  }

  /**
   * Track state transitions for flapping detection
   * @param {string} serviceId - Service identifier
   * @param {string} newState - New state (healthy/unhealthy)
   * @returns {boolean} - True if service is flapping
   */
  recordStateChange(serviceId, newState) {
    const now = Date.now();
    const transitions = this.state.flapping.get(serviceId) || [];

    // Add new transition
    transitions.push({ time: now, state: newState });

    // Keep only last 10 transitions
    if (transitions.length > 10) {
      transitions.shift();
    }

    this.state.flapping.set(serviceId, transitions);

    // Check for flapping
    return this.isFlapping(serviceId);
  }

  /**
   * Detect if service is flapping
   * Flapping = threshold+ state changes in window
   * @param {string} serviceId - Service identifier
   * @returns {boolean} - True if flapping
   */
  isFlapping(serviceId) {
    const transitions = this.state.flapping.get(serviceId) || [];
    if (transitions.length < 3) return false;

    const threshold = this.config.alerts?.flappingThreshold || 3;
    const windowMs = (this.config.alerts?.flappingWindowMinutes || 10) * 60 * 1000;
    const now = Date.now();

    // Count transitions in window
    const recentTransitions = transitions.filter((t) => now - t.time < windowMs);
    return recentTransitions.length >= threshold;
  }

  /**
   * Get flapping status and transition count for a service
   * @param {string} serviceId - Service identifier
   * @returns {Object} - Flapping info
   */
  getFlappingInfo(serviceId) {
    const transitions = this.state.flapping.get(serviceId) || [];
    const windowMs = (this.config.alerts?.flappingWindowMinutes || 10) * 60 * 1000;
    const now = Date.now();

    const recentTransitions = transitions.filter((t) => now - t.time < windowMs);

    return {
      isFlapping: this.isFlapping(serviceId),
      transitionCount: recentTransitions.length,
      transitions: recentTransitions,
    };
  }

  /**
   * Check if service is acknowledged (manually muted)
   * @param {string} serviceId - Service identifier
   * @returns {boolean} - True if acknowledged
   */
  isAcknowledged(serviceId) {
    return this.state.acknowledged.has(serviceId);
  }

  /**
   * Acknowledge a service (mute alerts)
   * @param {string} serviceId - Service identifier
   */
  acknowledge(serviceId) {
    this.state.acknowledged.add(serviceId);
    logger.info(`Service acknowledged: ${serviceId}`);
  }

  /**
   * Unacknowledge a service (unmute alerts)
   * @param {string} serviceId - Service identifier
   */
  unacknowledge(serviceId) {
    this.state.acknowledged.delete(serviceId);
    logger.info(`Service unacknowledged: ${serviceId}`);
  }

  /**
   * Get current failure info for a service
   * @param {string} serviceId - Service identifier
   * @returns {Object|null} - Failure info or null
   */
  getFailure(serviceId) {
    return this.state.failures.get(serviceId) || null;
  }

  /**
   * Get all current failures
   * @returns {Array<Object>} - Array of failures with serviceId
   */
  getAllFailures() {
    return Array.from(this.state.failures.entries()).map(([id, info]) => ({
      serviceId: id,
      ...info,
    }));
  }

  /**
   * Update SSL certificate expiry date
   * @param {string} domain - Domain name
   * @param {Date} expiryDate - Certificate expiry date
   */
  updateSSLExpiry(domain, expiryDate) {
    this.state.sslExpiry.set(domain, expiryDate.toISOString());
  }

  /**
   * Get SSL certificate expiry date
   * @param {string} domain - Domain name
   * @returns {Date|null} - Expiry date or null
   */
  getSSLExpiry(domain) {
    const expiry = this.state.sslExpiry.get(domain);
    return expiry ? new Date(expiry) : null;
  }

  /**
   * Get statistics about current state
   * @returns {Object} - State statistics
   */
  getStats() {
    return {
      totalFailures: this.state.failures.size,
      flappingServices: Array.from(this.state.flapping.keys())
        .filter((id) => this.isFlapping(id)).length,
      acknowledgedServices: this.state.acknowledged.size,
      trackedSSLCerts: this.state.sslExpiry.size,
    };
  }

  /**
   * Clear all flapping history for a service
   * @param {string} serviceId - Service identifier
   */
  clearFlappingHistory(serviceId) {
    this.state.flapping.delete(serviceId);
  }

  /**
   * Stop auto-save interval (important for graceful shutdown)
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Graceful shutdown - save state and stop auto-save
   */
  shutdown() {
    logger.info('StateManager shutting down...');
    this.stopAutoSave();
    this.save();
  }
}
