/**
 * HTTP endpoint health checker
 * Checks HTTP endpoints and tracks response times for anomaly detection
 */

import HealthChecker from './HealthChecker.js';
import logger from '../utils/logger.js';

export default class HTTPChecker extends HealthChecker {
  /**
   * Check HTTP endpoint health
   * @param {Object} service - Service object with URL and options
   * @returns {Promise<HealthCheckResult>}
   */
  async check(service) {
    const startTime = Date.now();
    const url = service.httpCheck || service.url;
    const expectedStatus = service.expectedStatus || 200;
    const timeout = this.config.http?.timeout || 5000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: this.config.http?.followRedirects !== false ? 'follow' : 'manual',
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Check status code
      if (response.status === expectedStatus || response.ok) {
        return this.createSuccessResult(responseTime, {
          statusCode: response.status,
          statusText: response.statusText,
        });
      }

      return this.createFailureResult(
        responseTime,
        `Unexpected status: ${response.status} ${response.statusText}`,
        {
          statusCode: response.status,
          statusText: response.statusText,
          expectedStatus,
        },
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Provide helpful error messages
      let errorMessage = error.message;

      if (error.name === 'AbortError') {
        errorMessage = `Request timeout after ${timeout}ms`;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Domain not found';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timeout';
      }

      logger.debug(`HTTP check failed for ${url}`, { error: errorMessage });

      return this.createFailureResult(
        responseTime,
        errorMessage,
        { url, timeout },
      );
    }
  }

  /**
   * Perform multiple checks and return average response time
   * Useful for warming up or establishing baseline
   * @param {Object} service - Service to check
   * @param {number} count - Number of checks to perform
   * @returns {Promise<Object>}
   */
  async checkMultiple(service, count = 3) {
    const results = [];

    for (let i = 0; i < count; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.check(service);
      results.push(result);

      // Small delay between checks
      if (i < count - 1) {
        // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const responseTimes = results
      .filter((r) => r.healthy)
      .map((r) => r.responseTime);

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0;

    return {
      results,
      avgResponseTime,
      successRate: results.filter((r) => r.healthy).length / results.length,
    };
  }
}
