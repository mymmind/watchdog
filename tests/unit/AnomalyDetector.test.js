/**
 * Unit tests for AnomalyDetector
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import AnomalyDetector from '../../src/monitoring/AnomalyDetector.js';

describe('AnomalyDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new AnomalyDetector({
      anomaly: {
        enabled: true,
        multiplier: 3.0,
        sampleSize: 20,
      },
    });
  });

  describe('recordResponseTime', () => {
    it('should record response times', () => {
      detector.recordResponseTime('service:test', 100);
      detector.recordResponseTime('service:test', 150);
      detector.recordResponseTime('service:test', 120);

      const stats = detector.getStats('service:test');
      assert.ok(stats);
      assert.strictEqual(stats.samples, 3);
    });

    it('should not record when disabled', () => {
      const disabledDetector = new AnomalyDetector({
        anomaly: { enabled: false },
      });

      disabledDetector.recordResponseTime('service:test', 100);
      const stats = disabledDetector.getStats('service:test');

      assert.strictEqual(stats, null);
    });
  });

  describe('checkAnomaly', () => {
    it('should not detect anomaly with insufficient samples', () => {
      detector.recordResponseTime('service:test', 100);
      detector.recordResponseTime('service:test', 110);

      const result = detector.checkAnomaly('service:test', 500);

      assert.strictEqual(result.isAnomaly, false);
      assert.strictEqual(result.reason, 'insufficient samples');
    });

    it('should detect anomaly when response time exceeds threshold', () => {
      // Build baseline
      for (let i = 0; i < 10; i++) {
        detector.recordResponseTime('service:test', 100);
      }

      // Check with slow response (3x median = 300)
      const result = detector.checkAnomaly('service:test', 400);

      assert.strictEqual(result.isAnomaly, true);
      assert.ok(result.deviation > 3);
    });

    it('should not detect anomaly for normal response time', () => {
      // Build baseline
      for (let i = 0; i < 10; i++) {
        detector.recordResponseTime('service:test', 100);
      }

      // Check with normal response
      const result = detector.checkAnomaly('service:test', 110);

      assert.strictEqual(result.isAnomaly, false);
    });
  });

  describe('getStats', () => {
    it('should return statistics for tracked service', () => {
      detector.recordResponseTime('service:test', 100);
      detector.recordResponseTime('service:test', 200);
      detector.recordResponseTime('service:test', 150);

      const stats = detector.getStats('service:test');

      assert.ok(stats);
      assert.strictEqual(stats.samples, 3);
      assert.strictEqual(stats.median, 150);
      assert.strictEqual(stats.min, 100);
      assert.strictEqual(stats.max, 200);
    });

    it('should return null for untracked service', () => {
      const stats = detector.getStats('unknown:service');
      assert.strictEqual(stats, null);
    });
  });

  describe('clearHistory', () => {
    it('should clear response time history', () => {
      detector.recordResponseTime('service:test', 100);
      detector.recordResponseTime('service:test', 200);

      detector.clearHistory('service:test');

      const stats = detector.getStats('service:test');
      assert.strictEqual(stats, null);
    });
  });

  describe('getTrackedServices', () => {
    it('should return list of tracked services', () => {
      detector.recordResponseTime('service:one', 100);
      detector.recordResponseTime('service:two', 200);

      const services = detector.getTrackedServices();

      assert.ok(services.includes('service:one'));
      assert.ok(services.includes('service:two'));
      assert.strictEqual(services.length, 2);
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize and deserialize state', () => {
      detector.recordResponseTime('service:test', 100);
      detector.recordResponseTime('service:test', 150);
      detector.recordResponseTime('service:test', 120);

      const json = detector.toJSON();
      const newDetector = new AnomalyDetector({
        anomaly: { enabled: true, multiplier: 3.0, sampleSize: 20 },
      });
      newDetector.fromJSON(json);

      const stats = newDetector.getStats('service:test');
      assert.ok(stats);
      assert.strictEqual(stats.samples, 3);
    });
  });

  describe('getSummary', () => {
    it('should return summary of all tracked services', () => {
      detector.recordResponseTime('service:one', 100);
      detector.recordResponseTime('service:two', 200);

      const summary = detector.getSummary();

      assert.strictEqual(summary.enabled, true);
      assert.strictEqual(summary.multiplier, 3.0);
      assert.strictEqual(summary.trackedServices, 2);
      assert.ok(summary.services['service:one']);
      assert.ok(summary.services['service:two']);
    });
  });
});
