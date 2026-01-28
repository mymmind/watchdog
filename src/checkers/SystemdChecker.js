/**
 * Systemd service health checker
 * Checks systemd service status using systemctl
 */

import HealthChecker from './HealthChecker.js';
import { safeExecBool, safeExec } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class SystemdChecker extends HealthChecker {
  /**
   * Check systemd service health
   * @param {Object} service - Service object with service name
   * @returns {Promise<HealthCheckResult>}
   */
  async check(service) {
    const startTime = Date.now();

    try {
      // Use systemctl is-active for fast check
      const isActive = await this.isActive(service.name);

      if (isActive) {
        return this.createSuccessResult(Date.now() - startTime, {
          status: 'active',
        });
      }

      // If not active, get more details
      const status = await this.getDetailedStatus(service.name);

      return this.createFailureResult(
        Date.now() - startTime,
        `Service not active: ${status}`,
        { status },
      );
    } catch (error) {
      logger.error(`Systemd check failed for ${service.name}`, { error: error.message });
      return this.createFailureResult(
        Date.now() - startTime,
        error.message,
      );
    }
  }

  /**
   * Fast check if service is active
   * @param {string} serviceName - Service name
   * @returns {Promise<boolean>}
   */
  async isActive(serviceName) {
    return safeExecBool('systemctl', ['is-active', serviceName]);
  }

  /**
   * Get detailed service status
   * @param {string} serviceName - Service name
   * @returns {Promise<string>}
   */
  async getDetailedStatus(serviceName) {
    try {
      const output = safeExec('systemctl', ['is-active', serviceName]);
      return output || 'unknown';
    } catch (error) {
      // systemctl is-active returns the status in the error output
      return error.stderr || 'inactive';
    }
  }

  /**
   * Get service logs from journalctl
   * @param {string} serviceName - Service name
   * @param {number} lines - Number of log lines
   * @returns {Promise<string>}
   */
  async getServiceLogs(serviceName, lines = 10) {
    try {
      return safeExec('journalctl', [
        '-u',
        serviceName,
        '-n',
        lines.toString(),
        '--no-pager',
      ]);
    } catch {
      return '';
    }
  }

  /**
   * Restart a systemd service
   * @param {string} serviceName - Service name
   * @returns {Promise<Object>} - { success: boolean, message: string }
   */
  async restart(serviceName) {
    try {
      logger.info(`Restarting systemd service: ${serviceName}`);
      safeExec('systemctl', ['restart', serviceName]);
      logger.info(`Systemd service restarted successfully: ${serviceName}`);
      return { success: true, message: 'Service restarted successfully' };
    } catch (error) {
      logger.error(`Failed to restart systemd service: ${serviceName}`, { error: error.message });
      return { success: false, message: error.message };
    }
  }
}
