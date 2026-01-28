/**
 * Configuration loader that merges defaults, env vars, and user config
 * Handles loading discovered services and applying user overrides
 */

import fs from 'fs';
import { parse as parseYaml } from 'yaml';
import dotenv from 'dotenv';
import defaults from './defaults.js';
import logger from '../utils/logger.js';
import validateUserConfig from './schema.js';

export default class ConfigLoader {
  constructor(configPath = './watchdog.config.yml') {
    this.configPath = configPath;
  }

  /**
   * Load environment variables from .env file
   * @returns {Object} - Configuration from environment
   */
  loadEnv() {
    dotenv.config();

    return {
      telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
      },
      intervals: {
        services: parseInt(process.env.CHECK_INTERVAL_SERVICES || '60', 10) * 1000,
        endpoints: parseInt(process.env.CHECK_INTERVAL_ENDPOINTS || '300', 10) * 1000,
        resources: parseInt(process.env.CHECK_INTERVAL_RESOURCES || '300', 10) * 1000,
        ssl: parseInt(process.env.CHECK_INTERVAL_SSL || '86400', 10) * 1000,
        discovery: parseInt(process.env.CHECK_INTERVAL_DISCOVERY || '300', 10) * 1000,
      },
      thresholds: {
        disk: parseInt(process.env.DISK_THRESHOLD_PERCENT || '85', 10),
        ram: parseInt(process.env.RAM_THRESHOLD_PERCENT || '90', 10),
        cpu: parseInt(process.env.CPU_THRESHOLD_PERCENT || '95', 10),
      },
      alerts: {
        cooldownMinutes: parseInt(process.env.ALERT_COOLDOWN_MINUTES || '30', 10),
        recoveryNotify: process.env.RECOVERY_NOTIFY !== 'false',
        flappingThreshold: parseInt(process.env.FLAPPING_THRESHOLD || '3', 10),
        flappingWindowMinutes: parseInt(process.env.FLAPPING_WINDOW_MINUTES || '10', 10),
      },
      dashboard: {
        enabled: process.env.DASHBOARD_ENABLED !== 'false',
        port: parseInt(process.env.DASHBOARD_PORT || '3100', 10),
      },
      anomaly: {
        enabled: process.env.ANOMALY_DETECTION_ENABLED !== 'false',
        multiplier: parseFloat(process.env.ANOMALY_MULTIPLIER || '3.0'),
        sampleSize: parseInt(process.env.ANOMALY_SAMPLE_SIZE || '20', 10),
      },
    };
  }

  /**
   * Load user config from YAML file (if exists)
   * @returns {Object} - User configuration
   */
  loadUserConfig() {
    if (!fs.existsSync(this.configPath)) {
      logger.info('No user config found, using defaults');
      return {};
    }

    try {
      const yamlContent = fs.readFileSync(this.configPath, 'utf8');
      const userConfig = parseYaml(yamlContent);

      // Validate user config structure
      if (userConfig && Object.keys(userConfig).length > 0) {
        validateUserConfig(userConfig);
      }

      logger.info('Loaded user configuration', { path: this.configPath });
      return userConfig || {};
    } catch (error) {
      logger.error('Failed to parse user config', { error: error.message });
      throw new Error(`Invalid YAML in ${this.configPath}: ${error.message}`);
    }
  }

  /**
   * Load discovered services from auto-generated file
   * @returns {Object} - Discovered services
   */
  loadDiscoveredServices() {
    const discoveredPath = './discovered-services.yml';
    if (!fs.existsSync(discoveredPath)) {
      logger.info('No discovered services file found yet');
      return { docker: [], pm2: [], systemd: [] };
    }

    try {
      const yamlContent = fs.readFileSync(discoveredPath, 'utf8');
      const data = parseYaml(yamlContent);
      return data.discovered || { docker: [], pm2: [], systemd: [] };
    } catch (error) {
      logger.error('Failed to load discovered services', { error: error.message });
      return { docker: [], pm2: [], systemd: [] };
    }
  }

  /**
   * Validate required configuration fields
   * @param {Object} config - Configuration to validate
   * @returns {boolean} - True if valid
   * @throws {Error} - If required fields are missing
   */
  validate(config) {
    if (!config.telegram?.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required in .env file');
    }
    if (!config.telegram?.chatId) {
      throw new Error('TELEGRAM_CHAT_ID is required in .env file');
    }

    // Validate thresholds are reasonable
    if (config.thresholds.disk < 50 || config.thresholds.disk > 99) {
      throw new Error('DISK_THRESHOLD_PERCENT must be between 50-99');
    }
    if (config.thresholds.ram < 50 || config.thresholds.ram > 99) {
      throw new Error('RAM_THRESHOLD_PERCENT must be between 50-99');
    }
    if (config.thresholds.cpu < 50 || config.thresholds.cpu > 99) {
      throw new Error('CPU_THRESHOLD_PERCENT must be between 50-99');
    }

    return true;
  }

  /**
   * Deep merge two objects, with source overriding target
   * @param {Object} target - Base object
   * @param {Object} source - Override object
   * @returns {Object} - Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && key in target && !(source[key] instanceof Array)) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * Merge discovered services with user config overrides
   * @param {Object} discovered - Auto-discovered services
   * @param {Object} userConfig - User configuration
   * @returns {Object} - Final service list
   */
  mergeServices(discovered, userConfig) {
    const services = {
      docker: [],
      pm2: [],
      systemd: [],
      endpoints: userConfig.endpoints || [],
    };

    // Process Docker containers
    for (const container of discovered.docker || []) {
      // Skip if in ignore list
      if (!userConfig.ignore?.includes(container.name)) {
        // Apply user overrides
        const override = userConfig.overrides?.docker?.[container.name] || {};
        services.docker.push({ ...container, ...override });
      } else {
        logger.debug(`Ignoring Docker container: ${container.name}`);
      }
    }

    // Process PM2 processes
    for (const process of discovered.pm2 || []) {
      if (!userConfig.ignore?.includes(process.name)) {
        const override = userConfig.overrides?.pm2?.[process.name] || {};
        services.pm2.push({ ...process, ...override });
      } else {
        logger.debug(`Ignoring PM2 process: ${process.name}`);
      }
    }

    // Process systemd services
    for (const service of discovered.systemd || []) {
      const serviceName = typeof service === 'string' ? service : service.name;
      if (!userConfig.ignore?.includes(serviceName)) {
        const override = userConfig.overrides?.systemd?.[serviceName] || {};
        services.systemd.push({
          name: serviceName,
          type: 'systemd',
          ...override,
        });
      } else {
        logger.debug(`Ignoring systemd service: ${serviceName}`);
      }
    }

    return services;
  }

  /**
   * Load complete configuration by merging all sources
   * Order of precedence: user config > env vars > defaults
   * @returns {Object} - Complete configuration
   */
  load() {
    logger.info('Loading configuration...');

    // Load all sources
    const envConfig = this.loadEnv();
    const userConfig = this.loadUserConfig();
    const discovered = this.loadDiscoveredServices();

    // Merge: defaults < env < user config
    let config = this.deepMerge(defaults, envConfig);
    config = this.deepMerge(config, userConfig);

    // Merge services (discovered + user overrides)
    config.services = this.mergeServices(discovered, userConfig);

    // Validate
    this.validate(config);

    const totalServices = config.services.docker.length
      + config.services.pm2.length
      + config.services.systemd.length
      + config.services.endpoints.length;

    logger.info('Configuration loaded successfully', {
      services: totalServices,
      docker: config.services.docker.length,
      pm2: config.services.pm2.length,
      systemd: config.services.systemd.length,
      endpoints: config.services.endpoints.length,
    });

    return config;
  }
}
