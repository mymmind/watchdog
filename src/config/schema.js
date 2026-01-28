/**
 * Schema validation for user configuration
 * Ensures user-provided configs have valid structure and values
 */

/**
 * Validate user config structure and values
 * @param {Object} config - User configuration to validate
 * @throws {Error} - If validation fails
 * @returns {boolean} - True if valid
 */
export default function validateUserConfig(config) {
  const errors = [];

  // Config must be an object
  if (typeof config !== 'object' || config === null) {
    throw new Error('Configuration must be an object');
  }

  // Validate overrides structure
  if (config.overrides) {
    if (typeof config.overrides !== 'object') {
      errors.push('overrides must be an object');
    } else {
      // Validate Docker overrides
      if (config.overrides.docker) {
        if (typeof config.overrides.docker !== 'object') {
          errors.push('overrides.docker must be an object');
        } else {
          for (const [name, opts] of Object.entries(config.overrides.docker)) {
            if (opts.httpCheck && typeof opts.httpCheck !== 'string') {
              errors.push(`overrides.docker.${name}.httpCheck must be a string URL`);
            }
            if (opts.expectedStatus && typeof opts.expectedStatus !== 'number') {
              errors.push(`overrides.docker.${name}.expectedStatus must be a number`);
            }
          }
        }
      }

      // Validate PM2 overrides
      if (config.overrides.pm2) {
        if (typeof config.overrides.pm2 !== 'object') {
          errors.push('overrides.pm2 must be an object');
        } else {
          for (const [name, opts] of Object.entries(config.overrides.pm2)) {
            if (opts.httpCheck && typeof opts.httpCheck !== 'string') {
              errors.push(`overrides.pm2.${name}.httpCheck must be a string URL`);
            }
          }
        }
      }

      // Validate systemd overrides
      if (config.overrides.systemd) {
        if (typeof config.overrides.systemd !== 'object') {
          errors.push('overrides.systemd must be an object');
        }
      }
    }
  }

  // Validate ignore list
  if (config.ignore) {
    if (!Array.isArray(config.ignore)) {
      errors.push('ignore must be an array of service names');
    } else {
      for (const item of config.ignore) {
        if (typeof item !== 'string') {
          errors.push('All items in ignore list must be strings');
          break;
        }
      }
    }
  }

  // Validate endpoints
  if (config.endpoints) {
    if (!Array.isArray(config.endpoints)) {
      errors.push('endpoints must be an array');
    } else {
      config.endpoints.forEach((endpoint, i) => {
        if (typeof endpoint === 'string') {
          // Just URL is fine, validate it's a valid URL
          try {
            // eslint-disable-next-line no-new
            new URL(endpoint);
          } catch {
            errors.push(`endpoints[${i}] is not a valid URL: ${endpoint}`);
          }
        } else if (typeof endpoint === 'object' && endpoint !== null) {
          if (!endpoint.url) {
            errors.push(`endpoints[${i}] must have a url property`);
          } else {
            try {
              // eslint-disable-next-line no-new
              new URL(endpoint.url);
            } catch {
              errors.push(`endpoints[${i}].url is not a valid URL: ${endpoint.url}`);
            }
          }
          if (endpoint.checkSSL !== undefined && typeof endpoint.checkSSL !== 'boolean') {
            errors.push(`endpoints[${i}].checkSSL must be boolean`);
          }
          if (endpoint.expectedStatus !== undefined
              && typeof endpoint.expectedStatus !== 'number') {
            errors.push(`endpoints[${i}].expectedStatus must be a number`);
          }
          if (endpoint.name !== undefined && typeof endpoint.name !== 'string') {
            errors.push(`endpoints[${i}].name must be a string`);
          }
        } else {
          errors.push(`endpoints[${i}] must be a string (URL) or object`);
        }
      });
    }
  }

  // Validate thresholds
  if (config.thresholds) {
    if (typeof config.thresholds !== 'object') {
      errors.push('thresholds must be an object');
    } else {
      const validThresholds = ['disk', 'ram', 'cpu', 'sslDays'];
      for (const [key, value] of Object.entries(config.thresholds)) {
        if (!validThresholds.includes(key)) {
          errors.push(`Unknown threshold: ${key}. Valid: ${validThresholds.join(', ')}`);
        }
        if (typeof value !== 'number') {
          errors.push(`thresholds.${key} must be a number`);
        } else if (key === 'sslDays') {
          if (value < 1 || value > 365) {
            errors.push('thresholds.sslDays must be between 1-365');
          }
        } else if (value < 0 || value > 100) {
          errors.push(`thresholds.${key} must be between 0-100`);
        }
      }
    }
  }

  // Validate alerts config
  if (config.alerts) {
    if (typeof config.alerts !== 'object') {
      errors.push('alerts must be an object');
    } else {
      if (config.alerts.cooldownMinutes !== undefined) {
        if (typeof config.alerts.cooldownMinutes !== 'number'
            || config.alerts.cooldownMinutes < 1) {
          errors.push('alerts.cooldownMinutes must be a positive number');
        }
      }
      if (config.alerts.recoveryNotify !== undefined
          && typeof config.alerts.recoveryNotify !== 'boolean') {
        errors.push('alerts.recoveryNotify must be boolean');
      }
      if (config.alerts.flappingThreshold !== undefined) {
        if (typeof config.alerts.flappingThreshold !== 'number'
            || config.alerts.flappingThreshold < 2) {
          errors.push('alerts.flappingThreshold must be >= 2');
        }
      }
    }
  }

  // Validate anomaly config
  if (config.anomaly) {
    if (typeof config.anomaly !== 'object') {
      errors.push('anomaly must be an object');
    } else {
      if (config.anomaly.enabled !== undefined
          && typeof config.anomaly.enabled !== 'boolean') {
        errors.push('anomaly.enabled must be boolean');
      }
      if (config.anomaly.multiplier !== undefined) {
        if (typeof config.anomaly.multiplier !== 'number'
            || config.anomaly.multiplier < 1) {
          errors.push('anomaly.multiplier must be >= 1');
        }
      }
      if (config.anomaly.sampleSize !== undefined) {
        if (typeof config.anomaly.sampleSize !== 'number'
            || config.anomaly.sampleSize < 5) {
          errors.push('anomaly.sampleSize must be >= 5');
        }
      }
    }
  }

  // Validate dashboard config
  if (config.dashboard) {
    if (typeof config.dashboard !== 'object') {
      errors.push('dashboard must be an object');
    } else {
      if (config.dashboard.enabled !== undefined
          && typeof config.dashboard.enabled !== 'boolean') {
        errors.push('dashboard.enabled must be boolean');
      }
      if (config.dashboard.port !== undefined) {
        if (typeof config.dashboard.port !== 'number'
            || config.dashboard.port < 1
            || config.dashboard.port > 65535) {
          errors.push('dashboard.port must be between 1-65535');
        }
      }
    }
  }

  // If there are validation errors, throw
  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return true;
}
