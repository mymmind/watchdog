/**
 * System resource health checker
 * Checks disk, RAM, and CPU usage against thresholds
 */

import HealthChecker from './HealthChecker.js';
import { safeExec } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class ResourceChecker extends HealthChecker {
  constructor(config) {
    super(config);
    this.cache = {
      disk: null,
      ram: null,
      cpu: null,
    };
    this.cacheTimeout = 60000; // Cache for 60 seconds
    this.lastCheck = {
      disk: 0,
      ram: 0,
      cpu: 0,
    };
  }

  /**
   * Check all system resources
   * @returns {Promise<Object>}
   */
  async checkAll() {
    const [disk, ram, cpu] = await Promise.all([
      this.checkDisk(),
      this.checkRAM(),
      this.checkCPU(),
    ]);

    return { disk, ram, cpu };
  }

  /**
   * Check disk usage
   * @returns {Promise<HealthCheckResult>}
   */
  async checkDisk() {
    const startTime = Date.now();
    const threshold = this.config.thresholds?.disk || 85;

    // Use cache if recent
    if (this.cache.disk && Date.now() - this.lastCheck.disk < this.cacheTimeout) {
      return this.cache.disk;
    }

    try {
      const usage = await this.getDiskUsage();

      this.lastCheck.disk = Date.now();
      const result = usage >= threshold
        ? this.createFailureResult(
          Date.now() - startTime,
          `Disk usage at ${usage}% (threshold: ${threshold}%)`,
          { usage, threshold },
        )
        : this.createSuccessResult(Date.now() - startTime, {
          usage,
          threshold,
        });

      this.cache.disk = result;
      return result;
    } catch (error) {
      logger.error('Disk check failed', { error: error.message });
      return this.createFailureResult(
        Date.now() - startTime,
        error.message,
      );
    }
  }

  /**
   * Check RAM usage
   * @returns {Promise<HealthCheckResult>}
   */
  async checkRAM() {
    const startTime = Date.now();
    const threshold = this.config.thresholds?.ram || 90;

    // Use cache if recent
    if (this.cache.ram && Date.now() - this.lastCheck.ram < this.cacheTimeout) {
      return this.cache.ram;
    }

    try {
      const usage = await this.getRAMUsage();

      this.lastCheck.ram = Date.now();
      const result = usage >= threshold
        ? this.createFailureResult(
          Date.now() - startTime,
          `RAM usage at ${usage}% (threshold: ${threshold}%)`,
          { usage, threshold },
        )
        : this.createSuccessResult(Date.now() - startTime, {
          usage,
          threshold,
        });

      this.cache.ram = result;
      return result;
    } catch (error) {
      logger.error('RAM check failed', { error: error.message });
      return this.createFailureResult(
        Date.now() - startTime,
        error.message,
      );
    }
  }

  /**
   * Check CPU usage
   * @returns {Promise<HealthCheckResult>}
   */
  async checkCPU() {
    const startTime = Date.now();
    const threshold = this.config.thresholds?.cpu || 95;

    // Use cache if recent
    if (this.cache.cpu && Date.now() - this.lastCheck.cpu < this.cacheTimeout) {
      return this.cache.cpu;
    }

    try {
      const usage = await this.getCPUUsage();

      this.lastCheck.cpu = Date.now();
      const result = usage >= threshold
        ? this.createFailureResult(
          Date.now() - startTime,
          `CPU usage at ${usage}% (threshold: ${threshold}%)`,
          { usage, threshold },
        )
        : this.createSuccessResult(Date.now() - startTime, {
          usage,
          threshold,
        });

      this.cache.cpu = result;
      return result;
    } catch (error) {
      logger.error('CPU check failed', { error: error.message });
      return this.createFailureResult(
        Date.now() - startTime,
        error.message,
      );
    }
  }

  /**
   * Get disk usage percentage
   * @returns {Promise<number>}
   */
  async getDiskUsage() {
    const output = safeExec('df', ['-h', '/']);
    const lines = output.split('\n');

    // Parse df output (second line contains the data)
    if (lines.length < 2) {
      throw new Error('Unexpected df output format');
    }

    const parts = lines[1].trim().split(/\s+/);
    const usageStr = parts[4]; // e.g., "45%"

    return parseInt(usageStr.replace('%', ''), 10);
  }

  /**
   * Get RAM usage percentage
   * @returns {Promise<number>}
   */
  async getRAMUsage() {
    const output = safeExec('free', []);
    const lines = output.split('\n');

    // Parse free output
    // Format: Mem: total used free shared buff/cache available
    const memLine = lines.find((line) => line.startsWith('Mem:'));

    if (!memLine) {
      throw new Error('Unexpected free output format');
    }

    const parts = memLine.trim().split(/\s+/);
    const total = parseInt(parts[1], 10);
    const used = parseInt(parts[2], 10);

    const usage = (used / total) * 100;
    return Math.round(usage);
  }

  /**
   * Get CPU usage percentage
   * Uses top command with batch mode
   * @returns {Promise<number>}
   */
  async getCPUUsage() {
    // Use top in batch mode to get one snapshot
    const output = safeExec('top', ['-bn1']);
    const lines = output.split('\n');

    // Find CPU line (format varies by system)
    // Linux: %Cpu(s): 12.5 us,  3.1 sy,  0.0 ni, 84.4 id...
    // BusyBox: CPU:  5% usr  2% sys  0% nic 93% idle  0% io  0% irq  0% sirq
    const cpuLine = lines.find((line) => line.includes('Cpu') || line.includes('CPU'));

    if (!cpuLine) {
      throw new Error('Could not parse CPU usage from top');
    }

    // Try GNU top format first: "84.4 id"
    let idleMatch = cpuLine.match(/(\d+\.?\d*)\s*%?\s*id/);

    // Try BusyBox format: "93% idle"
    if (!idleMatch) {
      idleMatch = cpuLine.match(/(\d+)%\s+idle/);
    }

    if (idleMatch) {
      const idle = parseFloat(idleMatch[1]);
      const usage = 100 - idle;
      return Math.round(usage);
    }

    throw new Error('Could not parse CPU idle percentage');
  }

  /**
   * Clear the cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.cache = {
      disk: null,
      ram: null,
      cpu: null,
    };
    this.lastCheck = {
      disk: 0,
      ram: 0,
      cpu: 0,
    };
  }
}
