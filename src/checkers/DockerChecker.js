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
        const health = await this.getHealthStatus(service.name);

        if (health.status === 'healthy') {
          return this.createSuccessResult(Date.now() - startTime, {
            state: state.status,
            healthStatus: health.status,
          });
        }

        const errorMsg = health.log
          ? `Container health: ${health.status} - ${health.log.slice(0, 200)}`
          : `Container health: ${health.status}`;

        return this.createFailureResult(
          Date.now() - startTime,
          errorMsg,
          { state: state.status, healthStatus: health.status, healthLog: health.log },
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
   * Get container health status with details
   * @param {string} containerName - Container name
   * @returns {Promise<Object>}
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
        return { status: 'no-healthcheck', log: null };
      }

      // Get the last health check log entry if unhealthy
      if (health === 'unhealthy' || health === 'starting') {
        try {
          const log = safeExec('docker', [
            'inspect',
            '--format',
            '{{if .State.Health.Log}}{{(index .State.Health.Log 0).Output}}{{end}}',
            containerName,
          ]);
          return { status: health, log: log || null };
        } catch {
          return { status: health, log: null };
        }
      }

      return { status: health, log: null };
    } catch {
      return { status: 'unknown', log: null };
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

  /**
   * Restart a Docker container
   * @param {string} containerName - Container name
   * @returns {Promise<Object>} - { success: boolean, message: string }
   */
  async restart(containerName) {
    try {
      logger.info(`Restarting container: ${containerName}`);
      safeExec('docker', ['restart', containerName]);
      logger.info(`Container restarted successfully: ${containerName}`);
      return { success: true, message: 'Container restarted successfully' };
    } catch (error) {
      logger.error(`Failed to restart container: ${containerName}`, { error: error.message });
      return { success: false, message: error.message };
    }
  }
}
