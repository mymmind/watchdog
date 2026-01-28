/**
 * Docker container health checker
 * Checks Docker container state and health status
 */

import HealthChecker from './HealthChecker.js';
import { safeExec } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class DockerChecker extends HealthChecker {
  /**
   * Check Docker container health
   * @param {Object} service - Service object with container info
   * @returns {Promise<HealthCheckResult>}
   */
  async check(service) {
    const startTime = Date.now();

    try {
      // Check container state
      const state = await this.getContainerState(service.name);

      if (!state) {
        return this.createFailureResult(
          Date.now() - startTime,
          'Container not found or not running',
        );
      }

      // If container has a health check, use it
      if (service.hasHealthCheck) {
        const healthStatus = await this.getHealthStatus(service.name);

        if (healthStatus === 'healthy') {
          return this.createSuccessResult(Date.now() - startTime, {
            state: state.status,
            healthStatus,
          });
        }

        return this.createFailureResult(
          Date.now() - startTime,
          `Container health: ${healthStatus}`,
          { state: state.status, healthStatus },
        );
      }

      // No health check defined, just check if running
      if (state.status === 'running') {
        return this.createSuccessResult(Date.now() - startTime, {
          state: state.status,
        });
      }

      return this.createFailureResult(
        Date.now() - startTime,
        `Container state: ${state.status}`,
        { state: state.status },
      );
    } catch (error) {
      logger.error(`Docker check failed for ${service.name}`, { error: error.message });
      return this.createFailureResult(
        Date.now() - startTime,
        error.message,
      );
    }
  }

  /**
   * Get container state
   * @param {string} containerName - Container name
   * @returns {Promise<Object|null>}
   */
  async getContainerState(containerName) {
    try {
      const statusOutput = safeExec('docker', [
        'inspect',
        '--format',
        '{{.State.Status}}',
        containerName,
      ]);

      return {
        status: statusOutput,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get container health status
   * @param {string} containerName - Container name
   * @returns {Promise<string>}
   */
  async getHealthStatus(containerName) {
    try {
      const health = safeExec('docker', [
        'inspect',
        '--format',
        '{{.State.Health.Status}}',
        containerName,
      ]);

      if (health === '<no value>' || !health) {
        return 'no-healthcheck';
      }

      return health;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get container logs (useful for error reporting)
   * @param {string} containerName - Container name
   * @param {number} lines - Number of log lines to retrieve
   * @returns {Promise<string>}
   */
  async getContainerLogs(containerName, lines = 5) {
    try {
      return safeExec('docker', [
        'logs',
        '--tail',
        lines.toString(),
        containerName,
      ]);
    } catch {
      return '';
    }
  }
}
