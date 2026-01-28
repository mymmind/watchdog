/**
 * Base class for all health checkers
 * Defines the interface that all checkers must implement
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {boolean} healthy - Is the service healthy?
 * @property {number} responseTime - Check duration in milliseconds
 * @property {string|null} error - Error message if unhealthy
 * @property {Object} metadata - Additional checker-specific data
 */

export default class HealthChecker {
  /**
   * Create a health checker
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Perform health check on a service
   * Must be implemented by subclasses
   * @param {Object} _service - Service to check
   * @returns {Promise<HealthCheckResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async check(_service) {
    throw new Error(`check() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Helper to create a successful result
   * @param {number} responseTime - Duration in ms
   * @param {Object} metadata - Additional data
   * @returns {HealthCheckResult}
   */
  createSuccessResult(responseTime, metadata = {}) {
    return {
      healthy: true,
      responseTime,
      error: null,
      metadata,
    };
  }

  /**
   * Helper to create a failure result
   * @param {number} responseTime - Duration in ms
   * @param {string} error - Error message
   * @param {Object} metadata - Additional data
   * @returns {HealthCheckResult}
   */
  createFailureResult(responseTime, error, metadata = {}) {
    return {
      healthy: false,
      responseTime,
      error,
      metadata,
    };
  }
}
