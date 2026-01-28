/**
 * Watchdog - Main Application
 * Auto-discovering server monitoring with Telegram alerts
 */

import ConfigLoader from './config/ConfigLoader.js';
import ServiceDiscovery from './discovery/ServiceDiscovery.js';
import DiscoveredServicesWriter from './discovery/DiscoveredServicesWriter.js';
import StateManager from './monitoring/StateManager.js';
import Monitor from './monitoring/Monitor.js';
import TelegramNotifier from './notifications/TelegramNotifier.js';
import DashboardServer from './ui/DashboardServer.js';
import logger from './utils/logger.js';

class Watchdog {
  constructor() {
    this.config = null;
    this.stateManager = null;
    this.monitor = null;
    this.notifier = null;
    this.dashboard = null;
    this.discoveryInterval = null;
  }

  /**
   * Start Watchdog
   */
  async start() {
    try {
      logger.info('🐕 Watchdog starting...');

      // Step 1: Load initial configuration
      logger.info('Loading configuration...');
      const configLoader = new ConfigLoader();
      this.config = configLoader.load();

      // Step 2: Initialize state manager
      logger.info('Initializing state manager...');
      this.stateManager = new StateManager('./state.json', this.config);

      // Step 3: Initialize Telegram notifier
      logger.info('Initializing Telegram notifier...');
      this.notifier = new TelegramNotifier(this.config, this.stateManager);

      // Test Telegram connection
      const telegramOk = await this.notifier.testConnection();
      if (!telegramOk) {
        logger.warn('Telegram connection test failed - notifications may not work');
      }

      // Step 4: Run initial service discovery
      logger.info('Running service discovery...');
      await this.runDiscovery();

      // Reload config with discovered services
      this.config = configLoader.load();

      // Step 5: Initialize monitor
      logger.info('Initializing monitor...');
      this.monitor = new Monitor(
        this.config,
        this.stateManager,
        this.notifier,
        null, // dashboard will be set later
      );

      // Pass checkers to notifier for /restart command
      this.notifier.checkers = this.monitor.checkers;

      // Step 6: Initialize dashboard (if enabled)
      if (this.config.dashboard?.enabled) {
        logger.info('Initializing dashboard...');
        this.dashboard = new DashboardServer(
          this.config,
          this.stateManager,
          this.monitor.anomalyDetector,
          this.monitor.checkers, // Pass checkers for restart functionality
        );
        this.monitor.dashboard = this.dashboard;
        this.dashboard.start();
      }

      await this.monitor.start();

      // Step 7: Schedule periodic service discovery
      this.scheduleDiscovery();

      // Step 8: Send startup notification
      await this.notifier.sendStartupNotification();

      logger.info('✅ Watchdog is now running!');
      this.logSummary();
    } catch (error) {
      logger.error('Failed to start Watchdog', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }

  /**
   * Run service discovery and update configuration
   */
  async runDiscovery() {
    try {
      const discovery = new ServiceDiscovery();
      const writer = new DiscoveredServicesWriter();

      const discovered = await discovery.discover();
      writer.write(discovered);

      logger.info('Service discovery complete', {
        docker: discovered.docker.length,
        pm2: discovered.pm2.length,
        systemd: discovered.systemd.length,
      });
    } catch (error) {
      logger.error('Service discovery failed', { error: error.message });
    }
  }

  /**
   * Schedule periodic service discovery
   */
  scheduleDiscovery() {
    const intervalMs = this.config.intervals?.discovery || 300000; // 5 minutes default

    this.discoveryInterval = setInterval(async () => {
      logger.debug('Running scheduled service discovery...');
      await this.runDiscovery();

      // Reload config to pick up any new services
      const configLoader = new ConfigLoader();
      this.config = configLoader.load();

      // Update monitor config
      if (this.monitor) {
        this.monitor.config = this.config;
      }

      // Update dashboard config
      if (this.dashboard) {
        this.dashboard.config = this.config;
      }
    }, intervalMs);

    logger.info(`Scheduled service discovery every ${Math.round(intervalMs / 1000)}s`);
  }

  /**
   * Log startup summary
   */
  logSummary() {
    const totalServices = (this.config.services?.docker?.length || 0)
      + (this.config.services?.pm2?.length || 0)
      + (this.config.services?.systemd?.length || 0)
      + (this.config.services?.endpoints?.length || 0);

    logger.info('Monitoring Summary:', {
      totalServices,
      docker: this.config.services?.docker?.length || 0,
      pm2: this.config.services?.pm2?.length || 0,
      systemd: this.config.services?.systemd?.length || 0,
      endpoints: this.config.services?.endpoints?.length || 0,
      dashboard: this.config.dashboard?.enabled
        ? `http://localhost:${this.config.dashboard.port}`
        : 'disabled',
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('🐕 Watchdog shutting down...');

    try {
      // Stop discovery interval
      if (this.discoveryInterval) {
        clearInterval(this.discoveryInterval);
      }

      // Stop monitor
      if (this.monitor) {
        await this.monitor.shutdown();
      }

      // Stop dashboard
      if (this.dashboard) {
        this.dashboard.stop();
      }

      // Save state
      if (this.stateManager) {
        this.stateManager.shutdown();
      }

      // Send shutdown notification and stop bot
      if (this.notifier) {
        await this.notifier.sendShutdownNotification();
        this.notifier.stopPolling();
      }

      logger.info('✅ Watchdog shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  }
}

// Create Watchdog instance
const watchdog = new Watchdog();

// Graceful shutdown handlers
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal');
  watchdog.shutdown();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal');
  watchdog.shutdown();
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  watchdog.shutdown();
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    promise,
  });
});

// Start Watchdog
watchdog.start().catch((error) => {
  logger.error('Failed to start Watchdog', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
