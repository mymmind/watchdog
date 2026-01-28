/**
 * Unit tests for StateManager
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import StateManager from '../../src/monitoring/StateManager.js';

const TEST_STATE_PATH = './test-state.json';

describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    // Clean up any existing test state file
    if (fs.existsSync(TEST_STATE_PATH)) {
      fs.unlinkSync(TEST_STATE_PATH);
    }
    stateManager = new StateManager(TEST_STATE_PATH, {
      alerts: {
        cooldownMinutes: 30,
        flappingThreshold: 3,
        flappingWindowMinutes: 10,
      },
    });
  });

  afterEach(() => {
    // Cleanup
    if (stateManager) {
      stateManager.stopAutoSave();
    }
    if (fs.existsSync(TEST_STATE_PATH)) {
      fs.unlinkSync(TEST_STATE_PATH);
    }
  });

  describe('recordFailure', () => {
    it('should record first failure', () => {
      const action = stateManager.recordFailure('service:test', 'Test error');

      assert.strictEqual(action, 'first_failure');
      const failure = stateManager.getFailure('service:test');
      assert.ok(failure);
      assert.strictEqual(failure.error, 'Test error');
      assert.strictEqual(failure.consecutiveFailures, 1);
    });

    it('should record ongoing failure', () => {
      stateManager.recordFailure('service:test', 'Error 1');

      // Wait a bit to ensure cooldown expires
      const failure = stateManager.getFailure('service:test');
      failure.lastAlertSent = Date.now() - (31 * 60 * 1000); // 31 minutes ago

      const action = stateManager.recordFailure('service:test', 'Error 2');

      assert.strictEqual(action, 'ongoing_failure');
      const updated = stateManager.getFailure('service:test');
      assert.strictEqual(updated.consecutiveFailures, 2);
    });

    it('should suppress alerts during cooldown', () => {
      stateManager.recordFailure('service:test', 'Error 1');
      const action = stateManager.recordFailure('service:test', 'Error 2');

      assert.strictEqual(action, 'suppressed');
    });
  });

  describe('recordRecovery', () => {
    it('should record service recovery', async () => {
      stateManager.recordFailure('service:test', 'Test error');

      // Wait a small amount to ensure downtimeDuration > 0
      await new Promise((resolve) => { setTimeout(resolve, 10); });

      const recovery = stateManager.recordRecovery('service:test');

      assert.ok(recovery);
      assert.ok(recovery.downtimeDuration > 0);
      assert.strictEqual(recovery.failuresSeen, 1);
      assert.strictEqual(stateManager.getFailure('service:test'), null);
    });

    it('should return null for unknown service', () => {
      const recovery = stateManager.recordRecovery('unknown:service');
      assert.strictEqual(recovery, null);
    });
  });

  describe('flapping detection', () => {
    it('should detect flapping service', () => {
      const serviceId = 'service:flappy';

      // Simulate rapid state changes
      stateManager.recordStateChange(serviceId, 'unhealthy');
      stateManager.recordStateChange(serviceId, 'healthy');
      stateManager.recordStateChange(serviceId, 'unhealthy');

      assert.strictEqual(stateManager.isFlapping(serviceId), true);
    });

    it('should not detect flapping with few transitions', () => {
      const serviceId = 'service:stable';

      stateManager.recordStateChange(serviceId, 'unhealthy');
      stateManager.recordStateChange(serviceId, 'healthy');

      assert.strictEqual(stateManager.isFlapping(serviceId), false);
    });

    it('should get flapping info', () => {
      const serviceId = 'service:test';

      stateManager.recordStateChange(serviceId, 'unhealthy');
      stateManager.recordStateChange(serviceId, 'healthy');
      stateManager.recordStateChange(serviceId, 'unhealthy');

      const info = stateManager.getFlappingInfo(serviceId);

      assert.ok(info);
      assert.strictEqual(info.isFlapping, true);
      assert.strictEqual(info.transitionCount, 3);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge and unacknowledge service', () => {
      const serviceId = 'service:test';

      assert.strictEqual(stateManager.isAcknowledged(serviceId), false);

      stateManager.acknowledge(serviceId);
      assert.strictEqual(stateManager.isAcknowledged(serviceId), true);

      stateManager.unacknowledge(serviceId);
      assert.strictEqual(stateManager.isAcknowledged(serviceId), false);
    });
  });

  describe('persistence', () => {
    it('should save and load state', () => {
      stateManager.recordFailure('service:test', 'Test error');
      stateManager.save();

      // Create new state manager to load saved state
      const newStateManager = new StateManager(TEST_STATE_PATH);
      const failure = newStateManager.getFailure('service:test');

      assert.ok(failure);
      assert.strictEqual(failure.error, 'Test error');

      newStateManager.stopAutoSave();
    });
  });

  describe('getAllFailures', () => {
    it('should get all current failures', () => {
      stateManager.recordFailure('service:one', 'Error 1');
      stateManager.recordFailure('service:two', 'Error 2');

      const failures = stateManager.getAllFailures();

      assert.strictEqual(failures.length, 2);
      assert.ok(failures.find((f) => f.serviceId === 'service:one'));
      assert.ok(failures.find((f) => f.serviceId === 'service:two'));
    });
  });

  describe('getStats', () => {
    it('should get state statistics', () => {
      stateManager.recordFailure('service:test', 'Error');
      stateManager.acknowledge('service:ack');

      const stats = stateManager.getStats();

      assert.strictEqual(stats.totalFailures, 1);
      assert.strictEqual(stats.acknowledgedServices, 1);
    });
  });
});
