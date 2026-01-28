/**
 * Telegram Notifier
 * Sends formatted notifications to Telegram with rate limiting
 */

import TelegramBot from 'node-telegram-bot-api';
import MessageFormatter from './MessageFormatter.js';
import logger from '../utils/logger.js';

export default class TelegramNotifier {
  constructor(config) {
    this.config = config;
    this.formatter = new MessageFormatter();

    // Initialize Telegram bot
    this.bot = new TelegramBot(config.telegram.token, { polling: false });
    this.chatId = config.telegram.chatId;

    // Rate limiting
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.lastSentTime = 0;
    this.minInterval = 1000 / 30; // 30 messages per second max
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
}
