/**
 * Integration tests for Monitoring system
 * Tests Monitor orchestration with StateManager and checkers
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import Monitor from '../../src/monitoring/Monitor.js';
import StateManager from '../../src/monitoring/StateManager.js';

const TEST_STATE_PATH = './test-monitor-state.json';
const TEST_CONFIG = {
  intervals: {
    services: 60000, // 1 minute
    endpoints: 30000, // 30 seconds
    resources: 300000, // 5 minutes
    ssl: 86400000, // 24 hours
  },
  services: {
    docker: [],
    pm2: [],
    systemd: [],
    endpoints: [
      'https://httpbin.org/status/200', // Should be healthy
    ],
  },
  alerts: {
    cooldownMinutes: 30,
    flappingThreshold: 3,
    flappingWindowMinutes: 10,
    recoveryNotify: true,
  },
  anomalyDetection: {
    enabled: true,
    samplesRequired: 10,
    multiplier: 3,
  },
  resources: {
    disk: { threshold: 90 },
    ram: { threshold: 90 },
    cpu: { threshold: 90 },
  },
};

describe('Monitoring System Integration', () => {
  let stateManager;
  let monitor;
  let mockNotifier;

  beforeEach(() => {
    // Clean up any existing test state file
    if (fs.existsSync(TEST_STATE_PATH)) {
      fs.unlinkSync(TEST_STATE_PATH);
    }

    stateManager = new StateManager(TEST_STATE_PATH, TEST_CONFIG);

    // Mock notifier that tracks calls
    mockNotifier = {
      calls: [],
      async sendFailureAlert(serviceId, service, result, action) {
        this.calls.push({ type: 'failure', serviceId, action });
      },
      async sendRecoveryAlert(serviceId, service, recovery) {
        this.calls.push({ type: 'recovery', serviceId });
      },
      async sendAnomalyAlert(serviceId, service, anomaly) {
        this.calls.push({ type: 'anomaly', serviceId });
      },
      async sendFlappingAlert(serviceId, service, info) {
        this.calls.push({ type: 'flapping', serviceId });
      },
      async sendResourceWarning(type, result) {
        this.calls.push({ type: 'resource', resourceType: type });
      },
      async sendSSLWarning(serviceId, service, result) {
        this.calls.push({ type: 'ssl', serviceId });
      },
    };

    monitor = new Monitor(TEST_CONFIG, stateManager, mockNotifier);
  });

  afterEach(() => {
    if (monitor) {
      monitor.stop();
    }
    if (stateManager) {
      stateManager.stopAutoSave();
    }
    if (fs.existsSync(TEST_STATE_PATH)) {
      fs.unlinkSync(TEST_STATE_PATH);
    }
  });

  describe('Monitor initialization', () => {
    it('should initialize with all checkers', () => {
      assert.ok(monitor.checkers.docker);
      assert.ok(monitor.checkers.pm2);
      assert.ok(monitor.checkers.systemd);
      assert.ok(monitor.checkers.http);
      assert.ok(monitor.checkers.resource);
      assert.ok(monitor.checkers.ssl);
    });

    it('should initialize anomaly detector', () => {
      assert.ok(monitor.anomalyDetector);
    });

    it('should not be running before start', () => {
      assert.strictEqual(monitor.isRunning, false);
    });
  });

  describe('HTTP endpoint checking', () => {
    it('should record response time for healthy endpoints', () => {
      const serviceId = 'http:https://example.com';

      // Directly test anomaly detector integration
      monitor.anomalyDetector.recordResponseTime(serviceId, 150);

      // Should have recorded response time
      const stats = monitor.anomalyDetector.getStats(serviceId);
      assert.ok(stats);
      assert.strictEqual(stats.samples, 1);
      assert.ok(stats.all.includes(150));
    });

    it('should handle HTTP failures', async () => {
      const serviceId = 'http:https://nonexistent.invalid';
      const endpoint = { url: 'https://nonexistent.invalid' };

      // Simulate a failed check
      await monitor.handleCheckResult(serviceId, endpoint, {
        healthy: false,
        error: 'Connection refused',
      });

      // Should have recorded failure in state
      const failure = stateManager.getFailure(serviceId);
      assert.ok(failure);
      assert.ok(failure.error);

      // Should have sent notification
      const failureNotifications = mockNotifier.calls.filter((c) => c.type === 'failure');
      assert.ok(failureNotifications.length > 0);
    });
  });

  describe('Resource checking', () => {
    it('should check system resources', async () => {
      await monitor.checkResources();

      // Should not fail (resources should be available)
      // We can't assert specific values since they vary by system
    });
  });

  describe('Service failure and recovery flow', () => {
    it('should handle failure and recovery cycle', async () => {
      const serviceId = 'test:service';
      const service = { name: 'test-service', type: 'test' };

      // Simulate failure
      await monitor.handleCheckResult(serviceId, service, {
        healthy: false,
        error: 'Test error',
      });

      // Should have recorded failure
      const failure = stateManager.getFailure(serviceId);
      assert.ok(failure);
      assert.strictEqual(failure.consecutiveFailures, 1);

      // Should have sent notification
      const failureNotifications = mockNotifier.calls.filter(
        (c) => c.type === 'failure' && c.serviceId === serviceId,
      );
      assert.strictEqual(failureNotifications.length, 1);
      assert.strictEqual(failureNotifications[0].action, 'first_failure');

      // Wait a small amount to ensure downtime > 0
      await new Promise((resolve) => { setTimeout(resolve, 10); });

      // Simulate recovery
      await monitor.handleCheckResult(serviceId, service, {
        healthy: true,
      });

      // Should have cleared failure
      assert.strictEqual(stateManager.getFailure(serviceId), null);

      // Should have sent recovery notification
      const recoveryNotifications = mockNotifier.calls.filter(
        (c) => c.type === 'recovery' && c.serviceId === serviceId,
      );
      assert.strictEqual(recoveryNotifications.length, 1);
    });
  });

  describe('Flapping detection', () => {
    it('should detect and suppress flapping services', async () => {
      const serviceId = 'test:flappy';
      const service = { name: 'flappy-service', type: 'test' };

      // Simulate rapid state changes
      stateManager.recordStateChange(serviceId, 'unhealthy');
      stateManager.recordStateChange(serviceId, 'healthy');
      stateManager.recordStateChange(serviceId, 'unhealthy');

      // Now trigger a failure - should be detected as flapping
      await monitor.handleCheckResult(serviceId, service, {
        healthy: false,
        error: 'Flapping error',
      });

      // Should have sent flapping alert
      const flappingNotifications = mockNotifier.calls.filter(
        (c) => c.type === 'flapping' && c.serviceId === serviceId,
      );
      assert.ok(flappingNotifications.length > 0);
    });
  });

  describe('Anomaly detection integration', () => {
    it('should detect response time anomalies', async () => {
      const serviceId = 'http:test';
      const endpoint = { url: 'http://test.example.com' };

      // Record normal response times
      for (let i = 0; i < 10; i += 1) {
        monitor.anomalyDetector.recordResponseTime(serviceId, 100);
      }

      // Check for anomaly with slow response
      const responseTime = 400; // 4x normal
      monitor.anomalyDetector.recordResponseTime(serviceId, responseTime);
      const anomaly = monitor.anomalyDetector.checkAnomaly(serviceId, responseTime);

      // Verify anomaly was detected
      assert.ok(anomaly.isAnomaly);

      // Trigger anomaly handler
      await monitor.handleAnomaly(serviceId, endpoint, anomaly);

      // Should have sent anomaly alert
      const anomalyNotifications = mockNotifier.calls.filter(
        (c) => c.type === 'anomaly' && c.serviceId === serviceId,
      );
      assert.ok(anomalyNotifications.length > 0);
    });
  });

  describe('Monitor statistics', () => {
    it('should provide monitoring statistics', () => {
      const stats = monitor.getStats();

      assert.ok(stats);
      assert.strictEqual(stats.isRunning, false);
      assert.ok(stats.state);
      assert.ok(stats.anomalies);
    });
  });

  describe('cron expression generation', () => {
    it('should convert milliseconds to cron expressions', () => {
      // Seconds
      assert.strictEqual(monitor.cronFromMs(30000), '*/30 * * * * *');

      // Minutes
      assert.strictEqual(monitor.cronFromMs(120000), '*/2 * * * *');

      // Hours
      assert.strictEqual(monitor.cronFromMs(7200000), '0 */2 * * *');
    });
  });
});
