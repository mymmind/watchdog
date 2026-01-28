/**
 * Message Formatter
 * Creates formatted messages for all alert types
 */

export default class MessageFormatter {
  /**
   * Format service down alert
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} result - Check result
   * @param {string} alertAction - Alert action (first_failure, ongoing_failure)
   * @returns {string} - Formatted message
   */
  formatServiceDown(serviceId, service, result, alertAction) {
    const emoji = alertAction === 'first_failure' ? '🔴' : '⚠️';
    const title = alertAction === 'first_failure' ? 'SERVICE DOWN' : 'SERVICE STILL DOWN';

    let message = `${emoji} ${title}\n\n`;
    message += `Service: ${service.name}\n`;
    message += `Type: ${service.type || service.checker}\n`;
    message += `Error: ${result.error}\n`;

    if (result.metadata) {
      if (result.metadata.status) {
        message += `Status: ${result.metadata.status}\n`;
      }
      if (result.metadata.restarts !== undefined) {
        message += `Restarts: ${result.metadata.restarts}\n`;
      }
    }

    return message;
  }

  /**
   * Format service recovered alert
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} recovery - Recovery information
   * @returns {string} - Formatted message
   */
  formatServiceRecovered(serviceId, service, recovery) {
    const downtime = this.formatDuration(recovery.downtimeDuration);

    let message = '🟢 SERVICE RECOVERED\n\n';
    message += `Service: ${service.name}\n`;
    message += `Type: ${service.type || service.checker}\n`;
    message += `Downtime: ${downtime}\n`;
    message += `Failures: ${recovery.failuresSeen}\n`;

    return message;
  }

  /**
   * Format anomaly alert
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} anomaly - Anomaly detection result
   * @returns {string} - Formatted message
   */
  formatAnomaly(serviceId, service, anomaly) {
    const url = typeof service === 'string' ? service : service.url;

    let message = '⚠️ PERFORMANCE DEGRADATION\n\n';
    message += `Endpoint: ${url}\n`;
    message += `Current: ${anomaly.responseTime}ms\n`;
    message += `Normal: ${Math.round(anomaly.median)}ms\n`;
    message += `Slowdown: ${anomaly.deviation.toFixed(1)}x slower\n`;

    return message;
  }

  /**
   * Format flapping alert
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} flappingInfo - Flapping information
   * @returns {string} - Formatted message
   */
  formatFlapping(serviceId, service, flappingInfo) {
    let message = '⚡ SERVICE FLAPPING\n\n';
    message += `Service: ${service.name}\n`;
    message += `Type: ${service.type || service.checker}\n`;
    message += `Changes: ${flappingInfo.transitionCount} in last 10 minutes\n\n`;
    message += 'Service is unstable.\n';
    message += 'Further alerts suppressed for 30 minutes.';

    return message;
  }

  /**
   * Format resource warning
   * @param {string} resource - Resource type (disk, ram, cpu)
   * @param {Object} result - Check result
   * @returns {string} - Formatted message
   */
  formatResourceWarning(resource, result) {
    const emoji = result.metadata.usage >= 95 ? '🔴' : '⚠️';
    const resourceName = resource.toUpperCase();

    let message = `${emoji} ${resourceName} WARNING\n\n`;
    message += `${resourceName} usage: ${result.metadata.usage}%\n`;
    message += `Threshold: ${result.metadata.threshold}%\n`;

    return message;
  }

  /**
   * Format SSL expiry warning
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} result - Check result
   * @returns {string} - Formatted message
   */
  formatSSLWarning(serviceId, service, result) {
    const url = typeof service === 'string' ? service : service.url;
    const { daysRemaining } = result.metadata;
    const emoji = daysRemaining < 7 ? '🔴' : '⚠️';

    let message = `${emoji} SSL CERTIFICATE EXPIRING\n\n`;
    message += `Domain: ${url}\n`;
    message += `Days remaining: ${daysRemaining}\n`;
    message += `Expires: ${new Date(result.metadata.validTo).toLocaleDateString()}\n\n`;
    message += 'Action required: Renew certificate';

    return message;
  }

  /**
   * Format startup message
   * @param {Object} config - Configuration
   * @returns {string} - Formatted message
   */
  formatStartup(config) {
    const totalServices = (config.services?.docker?.length || 0)
      + (config.services?.pm2?.length || 0)
      + (config.services?.systemd?.length || 0)
      + (config.services?.endpoints?.length || 0);

    let message = '🐕 WATCHDOG STARTED\n\n';
    message += `Monitoring ${totalServices} services:\n`;
    message += `• Docker: ${config.services?.docker?.length || 0}\n`;
    message += `• PM2: ${config.services?.pm2?.length || 0}\n`;
    message += `• Systemd: ${config.services?.systemd?.length || 0}\n`;
    message += `• Endpoints: ${config.services?.endpoints?.length || 0}\n`;

    if (config.dashboard?.enabled) {
      message += `\nDashboard: http://localhost:${config.dashboard.port}`;
    }

    return message;
  }

  /**
   * Format shutdown message
   * @returns {string} - Formatted message
   */
  formatShutdown() {
    return '🐕 WATCHDOG STOPPED\n\nMonitoring has been stopped.';
  }

  /**
   * Format duration in human-readable form
   * @param {number} ms - Duration in milliseconds
   * @returns {string} - Human-readable duration
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Format timestamp
   * @param {number} timestamp - Unix timestamp
   * @returns {string} - Formatted timestamp
   */
  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  /**
   * Escape special characters for Telegram markdown
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeMarkdown(text) {
    // Telegram uses markdown-style formatting
    // Escape special characters
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }
}
