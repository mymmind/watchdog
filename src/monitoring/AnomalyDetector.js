/**
 * Anomaly Detector
 * Tracks response times and detects performance degradation
 * Uses statistical analysis to identify anomalies
 */

import CircularBuffer from '../utils/CircularBuffer.js';
import logger from '../utils/logger.js';

export default class AnomalyDetector {
  constructor(config = {}) {
    this.config = config;
    this.enabled = config.anomaly?.enabled !== false;
    this.multiplier = config.anomaly?.multiplier || 3.0;
    this.sampleSize = config.anomaly?.sampleSize || 20;

    // Track response times per service
    // serviceId -> CircularBuffer
    this.responseTimes = new Map();
  }

  /**
   * Record a response time sample
   * @param {string} serviceId - Service identifier
   * @param {number} responseTime - Response time in milliseconds
   */
  recordResponseTime(serviceId, responseTime) {
    if (!this.enabled) return;

    let buffer = this.responseTimes.get(serviceId);

    if (!buffer) {
      buffer = new CircularBuffer(this.sampleSize);
      this.responseTimes.set(serviceId, buffer);
    }

    buffer.push(responseTime);
  }

  /**
   * Check if current response time is anomalous
   * @param {string} serviceId - Service identifier
   * @param {number} responseTime - Current response time
   * @returns {Object} - Anomaly detection result
   */
  checkAnomaly(serviceId, responseTime) {
    if (!this.enabled) {
      return { isAnomaly: false, reason: 'detection disabled' };
    }

    const buffer = this.responseTimes.get(serviceId);

    // Need at least 5 samples to establish baseline
    if (!buffer || buffer.length() < 5) {
      return {
        isAnomaly: false,
        reason: 'insufficient samples',
        samplesCollected: buffer ? buffer.length() : 0,
        samplesNeeded: 5,
      };
    }

    const median = buffer.getMedian();
    const average = buffer.getAverage();
    const threshold = median * this.multiplier;

    // Check if current response time exceeds threshold
    const isAnomaly = responseTime > threshold;

    if (isAnomaly) {
      logger.warn(`Anomaly detected for ${serviceId}`, {
        current: responseTime,
        median,
        average,
        threshold,
        multiplier: this.multiplier,
      });
    }

    return {
      isAnomaly,
      responseTime,
      median,
      average,
      threshold,
      multiplier: this.multiplier,
      deviation: responseTime / median,
      samples: buffer.length(),
    };
  }

  /**
   * Get response time statistics for a service
   * @param {string} serviceId - Service identifier
   * @returns {Object|null} - Statistics or null if no data
   */
  getStats(serviceId) {
    const buffer = this.responseTimes.get(serviceId);

    if (!buffer || buffer.length() === 0) {
      return null;
    }

    return {
      samples: buffer.length(),
      median: buffer.getMedian(),
      average: buffer.getAverage(),
      min: buffer.getMin(),
      max: buffer.getMax(),
      all: buffer.getAll(),
    };
  }

  /**
   * Get all tracked services
   * @returns {Array<string>} - Array of service IDs
   */
  getTrackedServices() {
    return Array.from(this.responseTimes.keys());
  }

  /**
   * Clear response time history for a service
   * @param {string} serviceId - Service identifier
   */
  clearHistory(serviceId) {
    this.responseTimes.delete(serviceId);
    logger.debug(`Cleared anomaly history for ${serviceId}`);
  }

  /**
   * Export state for persistence
   * @returns {Object} - Serializable state
   */
  toJSON() {
    const data = {};

    for (const [serviceId, buffer] of this.responseTimes.entries()) {
      data[serviceId] = buffer.toJSON();
    }

    return data;
  }

  /**
   * Import state from persistence
   * @param {Object} data - Serialized state
   */
  fromJSON(data) {
    if (!data || typeof data !== 'object') return;

    for (const [serviceId, bufferData] of Object.entries(data)) {
      try {
        const buffer = CircularBuffer.fromJSON(bufferData);
        this.responseTimes.set(serviceId, buffer);
      } catch (error) {
        logger.error(`Failed to restore buffer for ${serviceId}`, {
          error: error.message,
        });
      }
    }

    logger.info('Anomaly detector state restored', {
      services: this.responseTimes.size,
    });
  }

  /**
   * Get summary of all anomalies
   * @returns {Object} - Summary statistics
   */
  getSummary() {
    const services = this.getTrackedServices();
    const summary = {
      enabled: this.enabled,
      multiplier: this.multiplier,
      sampleSize: this.sampleSize,
      trackedServices: services.length,
      services: {},
    };

    for (const serviceId of services) {
      const stats = this.getStats(serviceId);
      if (stats) {
        summary.services[serviceId] = stats;
      }
    }

    return summary;
  }
}
