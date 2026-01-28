/**
 * Docker container discovery
 * Discovers all running Docker containers with metadata
 */

import { safeExec, safeExecBool } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class DockerDiscovery {
  /**
   * Check if Docker is available on this system
   * @returns {boolean} - True if Docker is installed and accessible
   */
  isAvailable() {
    return safeExecBool('docker', ['--version']);
  }

  /**
   * Discover all running Docker containers
   * @returns {Array<Object>} - Array of container metadata
   */
  discover() {
    if (!this.isAvailable()) {
      logger.warn('Docker not available, skipping container discovery');
      return [];
    }

    try {
      // Get all running containers in JSON format
      const output = safeExec('docker', [
        'ps',
        '--format',
        '{{json .}}',
      ]);

      if (!output) {
        logger.info('No Docker containers found');
        return [];
      }

      const lines = output.split('\n').filter((line) => line.trim());
      const containers = lines.map((line) => JSON.parse(line));

      logger.info(`Discovered ${containers.length} Docker containers`);
      return containers.map((container) => this.parseContainer(container));
    } catch (error) {
      logger.error('Docker discovery failed', { error: error.message });
      return [];
    }
  }

  /**
   * Parse container info and extract useful metadata
   * @param {Object} container - Raw container data from docker ps
   * @returns {Object} - Parsed container metadata
   */
  parseContainer(container) {
    const ports = this.extractPorts(container.Ports);
    const hasHealthCheck = this.hasHealthCheck(container.Names);

    return {
      type: 'docker',
      name: container.Names,
      id: container.ID,
      status: container.Status,
      state: container.State,
      ports,
      hasHealthCheck,
      image: container.Image,
    };
  }

  /**
   * Extract port mappings from Docker ps output
   * Example: "0.0.0.0:3000->3000/tcp, 0.0.0.0:8080->8080/tcp" => [3000, 8080]
   * @param {string} portString - Ports string from docker ps
   * @returns {Array<number>} - Array of exposed port numbers
   */
  extractPorts(portString) {
    if (!portString) return [];

    const portRegex = /0\.0\.0\.0:(\d+)->/g;
    const ports = [];
    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = portRegex.exec(portString)) !== null) {
      ports.push(parseInt(match[1], 10));
    }

    return ports;
  }

  /**
   * Check if container has a health check defined
   * @param {string} containerName - Container name
   * @returns {boolean} - True if container has health check
   */
  hasHealthCheck(containerName) {
    try {
      const health = safeExec('docker', [
        'inspect',
        '--format',
        '{{.State.Health.Status}}',
        containerName,
      ]);
      // If health status exists and is not empty, container has health check
      return health !== '<no value>' && health !== '';
    } catch {
      return false;
    }
  }

  /**
   * Get container health status
   * @param {string} containerName - Container name
   * @returns {string|null} - Health status (healthy, unhealthy, starting) or null
   */
  getHealthStatus(containerName) {
    try {
      const health = safeExec('docker', [
        'inspect',
        '--format',
        '{{.State.Health.Status}}',
        containerName,
      ]);
      return health !== '<no value>' ? health : null;
    } catch {
      return null;
    }
  }
}
