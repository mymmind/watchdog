/**
 * PM2 process health checker
 * Checks PM2 process status and monitors for excessive restarts
 */

import HealthChecker from './HealthChecker.js';
import { safeExecJSON } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class PM2Checker extends HealthChecker {
  /**
   * Check PM2 process health
   * @param {Object} service - Service object with process info
   * @returns {Promise<HealthCheckResult>}
   */
  async check(service) {
    const startTime = Date.now();

    try {
      const processInfo = await this.getProcessInfo(service.name);

      if (!processInfo) {
        return this.createFailureResult(
          Date.now() - startTime,
          'Process not found in PM2',
        );
      }

      const { status, restarts, uptime } = processInfo;

      // Check if process is online
      if (status !== 'online') {
        return this.createFailureResult(
          Date.now() - startTime,
          `Process status: ${status}`,
          { status, restarts, uptime },
        );
      }

      // Check for excessive restarts (potential crash loop)
      const restartThreshold = 10;
      const uptimeThreshold = 5 * 60 * 1000; // 5 minutes

      if (restarts > restartThreshold && uptime < uptimeThreshold) {
        const uptimeSeconds = Math.round(uptime / 1000);
        return this.createFailureResult(
          Date.now() - startTime,
          `Process restarting frequently (${restarts} restarts, uptime: ${uptimeSeconds}s)`,
          {
            status, restarts, uptime, flapping: true,
          },
        );
      }

      return this.createSuccessResult(Date.now() - startTime, {
        status,
        restarts,
        uptime,
        memory: processInfo.memory,
        cpu: processInfo.cpu,
      });
    } catch (error) {
      logger.error(`PM2 check failed for ${service.name}`, { error: error.message });
      return this.createFailureResult(
        Date.now() - startTime,
        error.message,
      );
    }
  }

  /**
   * Get PM2 process information
   * @param {string} processName - Process name
   * @returns {Promise<Object|null>}
   */
  async getProcessInfo(processName) {
    try {
      const processes = safeExecJSON('pm2', ['jlist']);
      const proc = processes.find((p) => p.name === processName);

      if (!proc) {
        return null;
      }

      return {
        status: proc.pm2_env?.status || 'unknown',
        restarts: proc.pm2_env?.restart_time || 0,
        uptime: Date.now() - (proc.pm2_env?.pm_uptime || Date.now()),
        memory: proc.monit?.memory,
        cpu: proc.monit?.cpu,
        pid: proc.pid,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get PM2 process logs
   * @param {string} processName - Process name
   * @param {number} _lines - Number of log lines (reserved for future use)
   * @returns {Promise<string>}
   */
  // eslint-disable-next-line no-unused-vars
  async getProcessLogs(processName, _lines = 5) {
    try {
      const processes = safeExecJSON('pm2', ['jlist']);
      const proc = processes.find((p) => p.name === processName);

      if (!proc || !proc.pm2_env) {
        return '';
      }

      // PM2 log paths
      const errorLog = proc.pm2_env.pm_err_log_path;
      const outLog = proc.pm2_env.pm_out_log_path;

      return `Error log: ${errorLog}\nOutput log: ${outLog}`;
    } catch {
      return '';
    }
  }
}
