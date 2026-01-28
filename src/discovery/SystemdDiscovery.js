/**
 * Systemd service discovery
 * Discovers running systemd services (filtered to user-relevant ones)
 */

import { safeExec, safeExecBool } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class SystemdDiscovery {
  /**
   * Check if systemctl is available on this system
   * @returns {boolean} - True if systemd is available
   */
  isAvailable() {
    return safeExecBool('systemctl', ['--version']);
  }

  /**
   * Discover running systemd services
   * Only includes "interesting" services (not system internals)
   * @returns {Array<Object>} - Array of service metadata
   */
  discover() {
    if (!this.isAvailable()) {
      logger.warn('systemd not available, skipping service discovery');
      return [];
    }

    try {
      const output = safeExec('systemctl', [
        'list-units',
        '--type=service',
        '--state=running',
        '--no-pager',
        '--plain',
      ]);

      const lines = output.split('\n').filter((line) => line.trim());
      const services = [];

      // Parse systemctl output
      // Format: UNIT LOAD ACTIVE SUB DESCRIPTION
      for (const line of lines) {
        if (line.includes('.service')) {
          const parts = line.trim().split(/\s+/);
          const serviceName = parts[0];

          // Filter to only interesting services
          if (this.isInterestingService(serviceName)) {
            services.push({
              type: 'systemd',
              name: serviceName,
              status: 'running',
            });
          }
        }
      }

      logger.info(`Discovered ${services.length} systemd services`);
      return services;
    } catch (error) {
      logger.error('systemd discovery failed', { error: error.message });
      return [];
    }
  }

  /**
   * Filter to only user-relevant services (not boring system internals)
   * @param {string} name - Service name
   * @returns {boolean} - True if service is interesting
   */
  isInterestingService(name) {
    // Services we care about (web servers, databases, etc.)
    const interestingPrefixes = [
      'nginx',
      'apache',
      'httpd',
      'postgresql',
      'postgres',
      'mysql',
      'mariadb',
      'redis',
      'mongodb',
      'docker',
      'fail2ban',
      'ufw',
      'caddy',
      'traefik',
      'haproxy',
      'elasticsearch',
      'rabbitmq',
      'memcached',
    ];

    // System services to always exclude
    const boringSuffixes = [
      'systemd-',
      'dbus',
      'accounts-daemon',
      'cron',
      'rsyslog',
      'getty@',
      'user@',
      'session-',
    ];

    // Exclude boring services
    for (const boring of boringSuffixes) {
      if (name.startsWith(boring)) {
        return false;
      }
    }

    // Include interesting services
    for (const prefix of interestingPrefixes) {
      if (name.startsWith(prefix)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get detailed status of a systemd service
   * @param {string} serviceName - Service name
   * @returns {Object|null} - Service status or null
   */
  getServiceStatus(serviceName) {
    try {
      const output = safeExec('systemctl', ['status', serviceName, '--no-pager']);

      // Parse for key information
      const isActive = output.includes('Active: active');
      const isRunning = output.includes('(running)');

      return {
        active: isActive,
        running: isRunning,
        output,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if a service is active (simple boolean check)
   * @param {string} serviceName - Service name
   * @returns {boolean} - True if service is active
   */
  isActive(serviceName) {
    return safeExecBool('systemctl', ['is-active', serviceName]);
  }
}
