/**
 * Structured logger with color-coded output
 * Supports multiple log levels and prevents logging sensitive data
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
};

class Logger {
  constructor(minLevel = 'info') {
    this.minLevel = LOG_LEVELS[minLevel] || LOG_LEVELS.info;
  }

  /**
   * Log a message at the specified level
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Message to log
   * @param {Object} meta - Additional metadata to include
   */
  log(level, message, meta = {}) {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const color = COLORS[level] || COLORS.reset;

    // Sanitize metadata to remove sensitive keys
    const sanitizedMeta = this.sanitize(meta);
    const metaStr = Object.keys(sanitizedMeta).length > 0
      ? ` ${JSON.stringify(sanitizedMeta)}`
      : '';

    console.log(
      `${color}[${timestamp}] [${level.toUpperCase()}]${COLORS.reset} ${message}${metaStr}`,
    );
  }

  /**
   * Remove sensitive keys from metadata
   * @param {Object} meta - Metadata object
   * @returns {Object} - Sanitized metadata
   */
  sanitize(meta) {
    const sensitiveKeys = [
      'token',
      'password',
      'secret',
      'apikey',
      'api_key',
      'telegram_bot_token',
      'authorization',
    ];

    const sanitized = { ...meta };

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Log debug message
   */
  debug(message, meta) {
    this.log('debug', message, meta);
  }

  /**
   * Log info message
   */
  info(message, meta) {
    this.log('info', message, meta);
  }

  /**
   * Log warning message
   */
  warn(message, meta) {
    this.log('warn', message, meta);
  }

  /**
   * Log error message
   */
  error(message, meta) {
    this.log('error', message, meta);
  }
}

// Export singleton instance
export default new Logger(process.env.LOG_LEVEL || 'info');
