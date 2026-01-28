/**
 * Telegram Notifier
 * Sends formatted notifications to Telegram with rate limiting
 */

import TelegramBot from 'node-telegram-bot-api';
import MessageFormatter from './MessageFormatter.js';
import logger from '../utils/logger.js';

export default class TelegramNotifier {
  constructor(config, stateManager = null, checkers = null) {
    this.config = config;
    this.stateManager = stateManager;
    this.checkers = checkers; // { docker, pm2, systemd }
    this.formatter = new MessageFormatter();

    // Initialize Telegram bot with polling enabled for commands
    this.bot = new TelegramBot(config.telegram.token, { polling: true });
    this.chatId = config.telegram.chatId;

    // Rate limiting
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.lastSentTime = 0;
    this.minInterval = 1000 / 30; // 30 messages per second max

    // Set up command handlers
    this.setupCommandHandlers();

    // Handle polling errors
    this.bot.on('polling_error', (error) => {
      logger.error('Telegram polling error', { error: error.message });
    });
  }

  /**
   * Set up Telegram bot command handlers
   */
  setupCommandHandlers() {
    // /start command
    this.bot.onText(/\/start/, (msg) => this.handleStartCommand(msg));

    // /help command
    this.bot.onText(/\/help/, (msg) => this.handleHelpCommand(msg));

    // /status command
    this.bot.onText(/\/status/, (msg) => this.handleStatusCommand(msg));

    // /restart command - format: /restart docker:container-name
    this.bot.onText(/\/restart (.+)/, (msg, match) => this.handleRestartCommand(msg, match));

    logger.info('Telegram command handlers registered');
  }

  /**
   * Stop the bot (cleanup on shutdown)
   */
  stopPolling() {
    try {
      this.bot.stopPolling();
      logger.info('Telegram bot polling stopped');
    } catch (error) {
      logger.error('Failed to stop Telegram bot polling', { error: error.message });
    }
  }

  /**
   * Send a message to Telegram with rate limiting
   * @param {string} message - Message text
   * @returns {Promise<void>}
   */
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      this.messageQueue.push({ message, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process message queue with rate limiting
   */
  async processQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastSent = now - this.lastSentTime;

      // Wait if we're sending too fast
      if (timeSinceLastSent < this.minInterval) {
        // eslint-disable-next-line no-await-in-loop
        await this.sleep(this.minInterval - timeSinceLastSent);
      }

      const { message, resolve, reject } = this.messageQueue.shift();

      try {
        // eslint-disable-next-line no-await-in-loop
        await this.bot.sendMessage(this.chatId, message, {
          parse_mode: 'Markdown',
        });
        this.lastSentTime = Date.now();
        logger.debug('Telegram message sent');
        resolve();
      } catch (error) {
        logger.error('Failed to send Telegram message', { error: error.message });
        reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Sleep for a specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Send failure alert
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} result - Check result
   * @param {string} alertAction - Alert action
   */
  async sendFailureAlert(serviceId, service, result, alertAction) {
    try {
      const message = this.formatter.formatServiceDown(
        serviceId,
        service,
        result,
        alertAction,
      );
      await this.sendMessage(message);
      logger.info(`Failure alert sent for ${serviceId}`);
    } catch (error) {
      logger.error(`Failed to send failure alert for ${serviceId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Send recovery alert
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} recovery - Recovery information
   */
  async sendRecoveryAlert(serviceId, service, recovery) {
    try {
      const message = this.formatter.formatServiceRecovered(
        serviceId,
        service,
        recovery,
      );
      await this.sendMessage(message);
      logger.info(`Recovery alert sent for ${serviceId}`);
    } catch (error) {
      logger.error(`Failed to send recovery alert for ${serviceId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Send anomaly alert
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} anomaly - Anomaly detection result
   */
  async sendAnomalyAlert(serviceId, service, anomaly) {
    try {
      const message = this.formatter.formatAnomaly(
        serviceId,
        service,
        anomaly,
      );
      await this.sendMessage(message);
      logger.info(`Anomaly alert sent for ${serviceId}`);
    } catch (error) {
      logger.error(`Failed to send anomaly alert for ${serviceId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Send flapping alert
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} flappingInfo - Flapping information
   */
  async sendFlappingAlert(serviceId, service, flappingInfo) {
    try {
      const message = this.formatter.formatFlapping(
        serviceId,
        service,
        flappingInfo,
      );
      await this.sendMessage(message);
      logger.info(`Flapping alert sent for ${serviceId}`);
    } catch (error) {
      logger.error(`Failed to send flapping alert for ${serviceId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Send resource warning
   * @param {string} resource - Resource type (disk, ram, cpu)
   * @param {Object} result - Check result
   */
  async sendResourceWarning(resource, result) {
    try {
      const message = this.formatter.formatResourceWarning(resource, result);
      await this.sendMessage(message);
      logger.info(`Resource warning sent for ${resource}`);
    } catch (error) {
      logger.error(`Failed to send resource warning for ${resource}`, {
        error: error.message,
      });
    }
  }

  /**
   * Send SSL expiry warning
   * @param {string} serviceId - Service identifier
   * @param {Object} service - Service configuration
   * @param {Object} result - Check result
   */
  async sendSSLWarning(serviceId, service, result) {
    try {
      const message = this.formatter.formatSSLWarning(serviceId, service, result);
      await this.sendMessage(message);
      logger.info(`SSL warning sent for ${serviceId}`);
    } catch (error) {
      logger.error(`Failed to send SSL warning for ${serviceId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Send startup notification
   */
  async sendStartupNotification() {
    try {
      const message = this.formatter.formatStartup(this.config);
      await this.sendMessage(message);
      logger.info('Startup notification sent');
    } catch (error) {
      logger.error('Failed to send startup notification', {
        error: error.message,
      });
    }
  }

  /**
   * Send shutdown notification
   */
  async sendShutdownNotification() {
    try {
      const message = this.formatter.formatShutdown();
      await this.sendMessage(message);
      logger.info('Shutdown notification sent');
    } catch (error) {
      logger.error('Failed to send shutdown notification', {
        error: error.message,
      });
    }
  }

  /**
   * Test Telegram connection
   * @returns {Promise<boolean>} - True if connection successful
   */
  async testConnection() {
    try {
      await this.bot.sendMessage(this.chatId, '🐕 Watchdog connection test');
      logger.info('Telegram connection test successful');
      return true;
    } catch (error) {
      logger.error('Telegram connection test failed', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get queue status
   * @returns {Object} - Queue statistics
   */
  getQueueStatus() {
    return {
      queueLength: this.messageQueue.length,
      isProcessing: this.isProcessingQueue,
      lastSentTime: this.lastSentTime,
    };
  }

  /**
   * Handle /start command
   * @param {Object} msg - Telegram message object
   */
  async handleStartCommand(msg) {
    const chatId = msg.chat.id;
    const message = '🐕 *Watchdog Bot*\n\n'
      + 'I monitor your services and send alerts when issues are detected.\n\n'
      + 'Use /help to see available commands.';

    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to handle /start command', { error: error.message });
    }
  }

  /**
   * Handle /help command
   * @param {Object} msg - Telegram message object
   */
  async handleHelpCommand(msg) {
    const chatId = msg.chat.id;
    const message = '🐕 *Watchdog Commands*\n\n'
      + '*/status* - Get current status of all services\n'
      + '*/restart <service>* - Restart a service\n'
      + '  Examples:\n'
      + '  • `/restart docker:container-name`\n'
      + '  • `/restart pm2:app-name`\n'
      + '  • `/restart systemd:service-name`\n'
      + '*/help* - Show this help message';

    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to handle /help command', { error: error.message });
    }
  }

  /**
   * Handle /status command
   * @param {Object} msg - Telegram message object
   */
  async handleStatusCommand(msg) {
    const chatId = msg.chat.id;

    if (!this.stateManager) {
      await this.bot.sendMessage(chatId, '❌ Status unavailable - StateManager not initialized');
      return;
    }

    try {
      const services = this.getServicesStatus();
      const alerts = this.stateManager.getAllFailures();

      let message = '📊 *Server Status*\n\n';

      // Summary
      const healthy = services.filter((s) => s.healthy).length;
      const unhealthy = services.length - healthy;

      message += `*Services:* ${services.length} total\n`;
      message += `✅ Healthy: ${healthy}\n`;
      if (unhealthy > 0) {
        message += `❌ Unhealthy: ${unhealthy}\n`;
      }
      message += '\n';

      // Active alerts
      if (alerts.length > 0) {
        message += `🚨 *Active Alerts:* ${alerts.length}\n\n`;
        alerts.forEach((alert) => {
          const duration = this.formatDuration(Date.now() - alert.firstSeen);
          message += `❌ ${alert.serviceId}\n`;
          message += `   ${alert.error}\n`;
          message += `   Down for: ${duration}\n\n`;
        });
      } else {
        message += '✅ *No active alerts*\n\n';
      }

      // Service breakdown
      message += '*Services by Type:*\n';
      const servicesByType = this.groupServicesByType(services);

      Object.keys(servicesByType).forEach((type) => {
        const typeServices = servicesByType[type];
        const typeHealthy = typeServices.filter((s) => s.healthy).length;
        message += `\n*${type.toUpperCase()}* (${typeHealthy}/${typeServices.length} healthy)\n`;

        typeServices.forEach((service) => {
          const icon = service.healthy ? '✅' : '❌';
          message += `${icon} ${service.name}\n`;
        });
      });

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to handle /status command', { error: error.message });
      await this.bot.sendMessage(chatId, `❌ Error getting status: ${error.message}`);
    }
  }

  /**
   * Handle /restart command
   * @param {Object} msg - Telegram message object
   * @param {Array} match - Regex match array
   */
  async handleRestartCommand(msg, match) {
    const chatId = msg.chat.id;
    const serviceId = match[1];

    if (!this.checkers) {
      await this.bot.sendMessage(chatId, '❌ Restart unavailable - Checkers not initialized');
      return;
    }

    try {
      // Parse service ID (format: type:name)
      const [type, ...nameParts] = serviceId.split(':');
      const name = nameParts.join(':');

      if (!type || !name) {
        await this.bot.sendMessage(chatId, '❌ Invalid format. Use: /restart docker:name or /restart pm2:name');
        return;
      }

      logger.info('Restart command received via Telegram', { type, name, user: msg.from.username });

      let result;
      if (type === 'docker' && this.checkers.docker) {
        result = await this.checkers.docker.restart(name);
      } else if (type === 'pm2' && this.checkers.pm2) {
        result = await this.checkers.pm2.restart(name);
      } else if (type === 'systemd' && this.checkers.systemd) {
        result = await this.checkers.systemd.restart(name);
      } else {
        await this.bot.sendMessage(chatId, `❌ Unsupported service type: ${type}`);
        return;
      }

      if (result.success) {
        // Clear the failure from state
        if (this.stateManager) {
          this.stateManager.recordRecovery(serviceId);
        }
        await this.bot.sendMessage(chatId, `✅ Successfully restarted ${serviceId}`);
      } else {
        await this.bot.sendMessage(chatId, `❌ Failed to restart ${serviceId}: ${result.message}`);
      }
    } catch (error) {
      logger.error('Failed to handle /restart command', { error: error.message });
      await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  }

  /**
   * Get services status (similar to DashboardServer)
   * @returns {Array<Object>} - Array of service statuses
   */
  getServicesStatus() {
    const services = [];
    const config = this.config.services || {};

    // Docker services
    for (const service of config.docker || []) {
      const serviceId = `docker:${service.name}`;
      const failure = this.stateManager.getFailure(serviceId);

      services.push({
        id: serviceId,
        name: service.name,
        type: 'docker',
        healthy: !failure,
        error: failure?.error || null,
      });
    }

    // PM2 services
    for (const service of config.pm2 || []) {
      const serviceId = `pm2:${service.name}`;
      const failure = this.stateManager.getFailure(serviceId);

      services.push({
        id: serviceId,
        name: service.name,
        type: 'pm2',
        healthy: !failure,
        error: failure?.error || null,
      });
    }

    // Systemd services
    for (const service of config.systemd || []) {
      const serviceId = `systemd:${service.name}`;
      const failure = this.stateManager.getFailure(serviceId);

      services.push({
        id: serviceId,
        name: service.name,
        type: 'systemd',
        healthy: !failure,
        error: failure?.error || null,
      });
    }

    // HTTP endpoints
    for (const endpoint of config.endpoints || []) {
      const url = typeof endpoint === 'string' ? endpoint : endpoint.url;
      const serviceId = `http:${url}`;
      const failure = this.stateManager.getFailure(serviceId);

      services.push({
        id: serviceId,
        name: url,
        type: 'http',
        healthy: !failure,
        error: failure?.error || null,
      });
    }

    return services;
  }

  /**
   * Group services by type
   * @param {Array<Object>} services - Services array
   * @returns {Object} - Services grouped by type
   */
  groupServicesByType(services) {
    const grouped = {};
    services.forEach((service) => {
      if (!grouped[service.type]) {
        grouped[service.type] = [];
      }
      grouped[service.type].push(service);
    });
    return grouped;
  }

  /**
   * Format duration in human-readable format
   * @param {number} ms - Duration in milliseconds
   * @returns {string} - Formatted duration
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
}
