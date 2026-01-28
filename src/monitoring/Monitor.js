/**
 * Monitor - Main monitoring orchestrator
 * Coordinates all health checkers, schedules checks, manages state
 */

import cron from 'node-cron';
import DockerChecker from '../checkers/DockerChecker.js';
import PM2Checker from '../checkers/PM2Checker.js';
import SystemdChecker from '../checkers/SystemdChecker.js';
import HTTPChecker from '../checkers/HTTPChecker.js';
import ResourceChecker from '../checkers/ResourceChecker.js';
import SSLChecker from '../checkers/SSLChecker.js';
import StateManager from './StateManager.js';
import AnomalyDetector from './AnomalyDetector.js';
import logger from '../utils/logger.js';

export default class Monitor {
  constructor(config, stateManager, notifier, dashboard = null) {
    this.config = config;
    this.stateManager = stateManager || new StateManager('./state.json', config);
    this.notifier = notifier;
    this.dashboard = dashboard;
    this.anomalyDetector = new AnomalyDetector(config);

    // Initialize checkers
    this.checkers = {
      docker: new DockerChecker(config),
      pm2: new PM2Checker(config),
      systemd: new SystemdChecker(config),
      http: new HTTPChecker(config),
      resource: new ResourceChecker(config),
      ssl: new SSLChecker(config),
    };

    // Cron jobs
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Start monitoring with cron schedules
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Monitor already running');
      return;
    }

    logger.info('Starting monitor...');
    this.isRunning = true;

    // Schedule service checks (Docker, PM2, systemd)
    const serviceInterval = this.cronFromMs(this.config.intervals.services);
    this.jobs.push(cron.schedule(serviceInterval, () => {
      this.checkServices().catch((error) => {
        logger.error('Service check failed', { error: error.message });
      });
    }));

    // Schedule endpoint checks (HTTP + anomaly detection)
    const endpointInterval = this.cronFromMs(this.config.intervals.endpoints);
    this.jobs.push(cron.schedule(endpointInterval, () => {
      this.checkEndpoints().catch((error) => {
        logger.error('Endpoint check failed', { error: error.message });
      });
    }));

    // Schedule resource checks (disk, RAM, CPU)
    const resourceInterval = this.cronFromMs(this.config.intervals.resources);
    this.jobs.push(cron.schedule(resourceInterval, () => {
      this.checkResources().catch((error) => {
        logger.error('Resource check failed', { error: error.message });
      });
    }));

    // Schedule SSL checks (once daily)
    const sslInterval = this.cronFromMs(this.config.intervals.ssl);
    this.jobs.push(cron.schedule(sslInterval, () => {
      this.checkSSL().catch((error) => {
        logger.error('SSL check failed', { error: error.message });
      });
    }));

    // Run initial checks immediately
    await this.runInitialChecks();

    logger.info('Monitor started with scheduled checks');
  }

  /**
   * Run initial checks on startup
   */
  async runInitialChecks() {
    logger.info('Running initial health checks...');

    await Promise.allSettled([
      this.checkServices(),
      this.checkEndpoints(),
      this.checkResources(),
    ]);

    logger.info('Initial health checks complete');
  }

  /**
   * Check all services (Docker, PM2, systemd)
   */
  async checkServices() {
    const services = [
      ...this.config.services.docker.map((s) => ({ ...s, checker: 'docker' })),
      ...this.config.services.pm2.map((s) => ({ ...s, checker: 'pm2' })),
      ...this.config.services.systemd.map((s) => ({ ...s, checker: 'systemd' })),
    ];

    logger.debug(`Checking ${services.length} services`);

    const results = await Promise.allSettled(
      services.map((service) => this.checkService(service)),
    );

    const failures = results.filter((r) => r.status === 'rejected').length;
    logger.debug(`Service check complete: ${failures} failures`);
  }

  /**
   * Check a single service
   * @param {Object} service - Service configuration
   */
  async checkService(service) {
    const checker = this.checkers[service.checker];
    const serviceId = `${service.type || service.checker}:${service.name}`;

    try {
      const result = await checker.check(service);

      await this.handleCheckResult(serviceId, service, result);
    } catch (error) {
      logger.error(`Check failed for ${serviceId}`, { error: error.message });
    }
  }

  /**
   * Check all HTTP endpoints
   */
  async checkEndpoints() {
    const endpoints = this.config.services.endpoints || [];

    logger.debug(`Checking ${endpoints.length} HTTP endpoints`);

    const results = await Promise.allSettled(
      endpoints.map((endpoint) => this.checkEndpoint(endpoint)),
    );

    const failures = results.filter((r) => r.status === 'rejected').length;
    logger.debug(`Endpoint check complete: ${failures} failures`);
  }

  /**
   * Check a single HTTP endpoint
   * @param {Object} endpoint - Endpoint configuration
   */
  async checkEndpoint(endpoint) {
    const url = typeof endpoint === 'string' ? endpoint : endpoint.url;
    const serviceId = `http:${url}`;

    try {
      const result = await this.checkers.http.check(endpoint);

      // Record response time for anomaly detection
      if (result.healthy) {
        this.anomalyDetector.recordResponseTime(serviceId, result.responseTime);

        // Check for anomalies
        const anomaly = this.anomalyDetector.checkAnomaly(serviceId, result.responseTime);

        if (anomaly.isAnomaly) {
          await this.handleAnomaly(serviceId, endpoint, anomaly);
        }
      }

      await this.handleCheckResult(serviceId, endpoint, result);
    } catch (error) {
      logger.error(`Endpoint check failed for ${url}`, { error: error.message });
    }
  }

  /**
   * Check system resources
   */
  async checkResources() {
    logger.debug('Checking system resources');

    try {
      const results = await this.checkers.resource.checkAll();

      // Update dashboard with resource status
      if (this.dashboard) {
        this.dashboard.updateResourceStatus(results);
      }

      await this.handleCheckResult('resource:disk', { name: 'disk' }, results.disk);
      await this.handleCheckResult('resource:ram', { name: 'ram' }, results.ram);
      await this.handleCheckResult('resource:cpu', { name: 'cpu' }, results.cpu);
    } catch (error) {
      logger.error('Resource check failed', { error: error.message });
    }
  }

  /**
   * Check SSL certificates
   */
  async checkSSL() {
    const endpoints = this.config.services.endpoints || [];
    const httpsEndpoints = endpoints.filter((e) => {
      const url = typeof e === 'string' ? e : e.url;
      return url.startsWith('https://');
    });

    logger.debug(`Checking ${httpsEndpoints.length} SSL certificates`);

    await Promise.allSettled(
      httpsEndpoints.map((endpoint) => this.checkSSLCert(endpoint)),
    );
  }

  /**
   * Check SSL certificate for an endpoint
   * @param {Object} endpoint - Endpoint configuration
   */
  async checkSSLCert(endpoint) {
    const url = typeof endpoint === 'string' ? endpoint : endpoint.url;
    const serviceId = `ssl:${url}`;

    try {
      const result = await this.checkers.ssl.check({ url });

      await this.handleCheckResult(serviceId, { url }, result);
    } catch (error) {
      logger.error(`SSL check failed for ${url}`, { error: error.message });
    }
  }

  /**
   * Handle check result and update state
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} result - Check result
   */
  async handleCheckResult(serviceId, service, result) {
    // Skip if service is acknowledged (muted)
    if (this.stateManager.isAcknowledged(serviceId)) {
      return;
    }

    // Record state change for flapping detection
    const previousFailure = this.stateManager.getFailure(serviceId);
    const wasHealthy = !previousFailure;
    const isHealthy = result.healthy;

    if (wasHealthy !== isHealthy) {
      this.stateManager.recordStateChange(serviceId, isHealthy ? 'healthy' : 'unhealthy');
    }

    if (!result.healthy) {
      // Service is unhealthy
      await this.handleFailure(serviceId, service, result);
    } else if (previousFailure) {
      // Service recovered
      await this.handleRecovery(serviceId, service);
    }
  }

  /**
   * Handle service failure
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} result - Check result
   */
  async handleFailure(serviceId, service, result) {
    const alertAction = this.stateManager.recordFailure(serviceId, result.error);

    // Check for flapping
    if (this.stateManager.isFlapping(serviceId)) {
      const flappingInfo = this.stateManager.getFlappingInfo(serviceId);
      logger.warn(`Service flapping detected: ${serviceId}`, flappingInfo);

      if (this.notifier) {
        await this.notifier.sendFlappingAlert(serviceId, service, flappingInfo);
      }
      return;
    }

    // Send alert based on action
    if (alertAction === 'first_failure' || alertAction === 'ongoing_failure') {
      logger.error(`Service failure: ${serviceId}`, {
        error: result.error,
        action: alertAction,
      });

      if (this.notifier) {
        // Special handling for SSL and resource warnings
        if (serviceId.startsWith('ssl:')) {
          await this.notifier.sendSSLWarning(serviceId, service, result);
        } else if (serviceId.startsWith('resource:')) {
          const resourceType = serviceId.split(':')[1];
          await this.notifier.sendResourceWarning(resourceType, result);
        } else {
          await this.notifier.sendFailureAlert(serviceId, service, result, alertAction);
        }
      }
    }
  }

  /**
   * Handle service recovery
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   */
  async handleRecovery(serviceId, service) {
    const recovery = this.stateManager.recordRecovery(serviceId);

    if (!recovery) return;

    logger.info(`Service recovered: ${serviceId}`, {
      downtime: `${Math.round(recovery.downtimeDuration / 1000)}s`,
    });

    // Send recovery notification if enabled
    if (this.config.alerts?.recoveryNotify && this.notifier) {
      await this.notifier.sendRecoveryAlert(serviceId, service, recovery);
    }

    // Clear flapping history on recovery
    this.stateManager.clearFlappingHistory(serviceId);
  }

  /**
   * Handle response time anomaly
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} anomaly - Anomaly detection result
   */
  async handleAnomaly(serviceId, service, anomaly) {
    logger.warn(`Performance anomaly: ${serviceId}`, anomaly);

    if (this.notifier) {
      await this.notifier.sendAnomalyAlert(serviceId, service, anomaly);
    }
  }

  /**
   * Convert milliseconds to cron expression
   * @param {number} ms - Milliseconds
   * @returns {string} - Cron expression
   */
  cronFromMs(ms) {
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
      return `*/${seconds} * * * * *`; // Every N seconds
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `*/${minutes} * * * *`; // Every N minutes
    }

    const hours = Math.floor(minutes / 60);
    return `0 */${hours} * * *`; // Every N hours
  }

  /**
   * Stop all monitoring
   */
  stop() {
    logger.info('Stopping monitor...');

    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
    this.isRunning = false;

    logger.info('Monitor stopped');
  }

  /**
   * Get current monitoring statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.jobs.length,
      state: this.stateManager.getStats(),
      anomalies: this.anomalyDetector.getSummary(),
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Monitor shutting down...');
    this.stop();
    this.stateManager.shutdown();
  }
}
