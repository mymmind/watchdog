/**
 * Service Discovery Orchestrator
 * Coordinates all discovery modules and aggregates results
 */

import DockerDiscovery from './DockerDiscovery.js';
import PM2Discovery from './PM2Discovery.js';
import SystemdDiscovery from './SystemdDiscovery.js';
import logger from '../utils/logger.js';

export default class ServiceDiscovery {
  constructor() {
    this.dockerDiscovery = new DockerDiscovery();
    this.pm2Discovery = new PM2Discovery();
    this.systemdDiscovery = new SystemdDiscovery();
  }

  /**
   * Run all discovery methods and aggregate results
   * @returns {Promise<Object>} - Discovered services with metadata
   */
  async discover() {
    logger.info('Starting service discovery scan...');
    const startTime = Date.now();

    // Run all discoverers in parallel for speed
    const [docker, pm2, systemd] = await Promise.all([
      Promise.resolve(this.dockerDiscovery.discover()),
      Promise.resolve(this.pm2Discovery.discover()),
      Promise.resolve(this.systemdDiscovery.discover()),
    ]);

    const discovered = {
      timestamp: new Date().toISOString(),
      scanDuration: Date.now() - startTime,
      docker,
      pm2,
      systemd,
      summary: {
        totalServices: docker.length + pm2.length + systemd.length,
        docker: docker.length,
        pm2: pm2.length,
        systemd: systemd.length,
      },
    };

    logger.info('Service discovery complete', {
      duration: `${discovered.scanDuration}ms`,
      ...discovered.summary,
    });

    return discovered;
  }

  /**
   * Get flat list of all discovered services
   * Useful for simple iteration
   * @returns {Promise<Array<Object>>} - Flat array of all services
   */
  async discoverFlat() {
    const discovered = await this.discover();
    return [
      ...discovered.docker,
      ...discovered.pm2,
      ...discovered.systemd,
    ];
  }

  /**
   * Get summary statistics about discovered services
   * @returns {Promise<Object>} - Summary statistics
   */
  async getSummary() {
    const discovered = await this.discover();
    return discovered.summary;
  }

  /**
   * Check availability of all discovery modules
   * @returns {Object} - Availability status for each module
   */
  checkAvailability() {
    return {
      docker: this.dockerDiscovery.isAvailable(),
      pm2: this.pm2Discovery.isAvailable(),
      systemd: this.systemdDiscovery.isAvailable(),
    };
  }
}
