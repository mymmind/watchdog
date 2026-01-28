/**
 * PM2 process discovery
 * Discovers all PM2-managed processes with metadata
 */

import { safeExecBool, safeExecJSON } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class PM2Discovery {
  /**
   * Check if PM2 is available on this system
   * @returns {boolean} - True if PM2 is installed and accessible
   */
  isAvailable() {
    return safeExecBool('pm2', ['--version']);
  }

  /**
   * Discover all PM2 processes
   * @returns {Array<Object>} - Array of process metadata
   */
  discover() {
    if (!this.isAvailable()) {
      logger.warn('PM2 not available, skipping process discovery');
      return [];
    }

    try {
      const processes = safeExecJSON('pm2', ['jlist']);

      if (!processes || processes.length === 0) {
        logger.info('No PM2 processes found');
        return [];
      }

      logger.info(`Discovered ${processes.length} PM2 processes`);
      return processes.map((proc) => this.parseProcess(proc));
    } catch (error) {
      logger.error('PM2 discovery failed', { error: error.message });
      return [];
    }
  }

  /**
   * Parse PM2 process info
   * @param {Object} proc - Raw process data from pm2 jlist
   * @returns {Object} - Parsed process metadata
   */
  parseProcess(proc) {
    const port = this.extractPort(proc);

    return {
      type: 'pm2',
      name: proc.name,
      pid: proc.pid,
      status: proc.pm2_env?.status || 'unknown',
      restarts: proc.pm2_env?.restart_time || 0,
      uptime: proc.pm2_env?.pm_uptime,
      port,
      script: proc.pm2_env?.pm_exec_path,
      memory: proc.monit?.memory,
      cpu: proc.monit?.cpu,
    };
  }

  /**
   * Try to extract port from environment variables or script args
   * Common patterns: PORT=3000, --port 3000, -p 3000
   * @param {Object} proc - PM2 process object
   * @returns {number|null} - Port number or null if not found
   */
  extractPort(proc) {
    // Check environment variables
    const env = proc.pm2_env?.env || {};
    if (env.PORT) {
      const port = parseInt(env.PORT, 10);
      if (!Number.isNaN(port)) {
        return port;
      }
    }

    // Check for common port env var names
    const portVars = ['PORT', 'HTTP_PORT', 'SERVER_PORT', 'APP_PORT'];
    for (const varName of portVars) {
      if (env[varName]) {
        const port = parseInt(env[varName], 10);
        if (!Number.isNaN(port)) {
          return port;
        }
      }
    }

    // Check command line args
    const args = proc.pm2_env?.args || [];
    for (let i = 0; i < args.length; i += 1) {
      if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
        const port = parseInt(args[i + 1], 10);
        if (!Number.isNaN(port)) {
          return port;
        }
      }
    }

    return null;
  }

  /**
   * Get detailed status of a PM2 process
   * @param {string} processName - Process name
   * @returns {Object|null} - Process status or null
   */
  getProcessStatus(processName) {
    try {
      const processes = safeExecJSON('pm2', ['jlist']);
      const proc = processes.find((p) => p.name === processName);
      return proc ? {
        status: proc.pm2_env?.status,
        uptime: proc.pm2_env?.pm_uptime,
        restarts: proc.pm2_env?.restart_time,
        memory: proc.monit?.memory,
        cpu: proc.monit?.cpu,
      } : null;
    } catch {
      return null;
    }
  }
}
