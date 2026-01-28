/**
 * Unit tests for MessageFormatter
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import MessageFormatter from '../../src/notifications/MessageFormatter.js';

describe('MessageFormatter', () => {
  describe('formatServiceDown', () => {
    it('should format first failure alert', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatServiceDown(
        'docker:test',
        { name: 'test-app', type: 'docker' },
        { error: 'Container stopped', metadata: {} },
        'first_failure',
      );

      assert.ok(message.includes('🔴 SERVICE DOWN'));
      assert.ok(message.includes('test-app'));
      assert.ok(message.includes('docker'));
      assert.ok(message.includes('Container stopped'));
    });

    it('should format ongoing failure alert', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatServiceDown(
        'pm2:test',
        { name: 'api-server', type: 'pm2' },
        { error: 'Process offline', metadata: {} },
        'ongoing_failure',
      );

      assert.ok(message.includes('⚠️ SERVICE STILL DOWN'));
      assert.ok(message.includes('api-server'));
    });
  });

  describe('formatServiceRecovered', () => {
    it('should format recovery alert', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatServiceRecovered(
        'docker:test',
        { name: 'test-app', type: 'docker' },
        { downtimeDuration: 120000, failuresSeen: 3 },
      );

      assert.ok(message.includes('🟢 SERVICE RECOVERED'));
      assert.ok(message.includes('test-app'));
      assert.ok(message.includes('Downtime:'));
      assert.ok(message.includes('Failures: 3'));
    });
  });

  describe('formatAnomaly', () => {
    it('should format anomaly alert', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatAnomaly(
        'http:api',
        { url: 'https://api.example.com' },
        {
          responseTime: 3000,
          median: 150,
          deviation: 20,
        },
      );

      assert.ok(message.includes('⚠️ PERFORMANCE DEGRADATION'));
      assert.ok(message.includes('https://api.example.com'));
      assert.ok(message.includes('3000ms'));
      assert.ok(message.includes('150ms'));
    });
  });

  describe('formatFlapping', () => {
    it('should format flapping alert', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatFlapping(
        'docker:test',
        { name: 'test-app', type: 'docker' },
        { transitionCount: 5 },
      );

      assert.ok(message.includes('⚡ SERVICE FLAPPING'));
      assert.ok(message.includes('test-app'));
      assert.ok(message.includes('5 in last 10 minutes'));
      assert.ok(message.includes('suppressed'));
    });
  });

  describe('formatResourceWarning', () => {
    it('should format resource warning', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatResourceWarning(
        'disk',
        { metadata: { usage: 90, threshold: 85 } },
      );

      assert.ok(message.includes('DISK WARNING'));
      assert.ok(message.includes('90%'));
      assert.ok(message.includes('85%'));
    });
  });

  describe('formatSSLWarning', () => {
    it('should format SSL expiry warning', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatSSLWarning(
        'ssl:example',
        { url: 'https://example.com' },
        {
          metadata: {
            daysRemaining: 10,
            validTo: new Date('2026-02-15'),
          },
        },
      );

      assert.ok(message.includes('SSL CERTIFICATE EXPIRING'));
      assert.ok(message.includes('https://example.com'));
      assert.ok(message.includes('10'));
      assert.ok(message.includes('Renew certificate'));
    });
  });

  describe('formatStartup', () => {
    it('should format startup message', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatStartup({
        services: {
          docker: [1, 2],
          pm2: [1],
          systemd: [1, 2, 3],
          endpoints: [1],
        },
        dashboard: {
          enabled: true,
          port: 3100,
        },
      });

      assert.ok(message.includes('🐕 WATCHDOG STARTED'));
      assert.ok(message.includes('Docker: 2'));
      assert.ok(message.includes('PM2: 1'));
      assert.ok(message.includes('Systemd: 3'));
      assert.ok(message.includes('http://localhost:3100'));
    });
  });

  describe('formatShutdown', () => {
    it('should format shutdown message', () => {
      const formatter = new MessageFormatter();
      const message = formatter.formatShutdown();

      assert.ok(message.includes('🐕 WATCHDOG STOPPED'));
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      const formatter = new MessageFormatter();
      const duration = formatter.formatDuration(30000); // 30 seconds
      assert.strictEqual(duration, '30s');
    });

    it('should format minutes', () => {
      const formatter = new MessageFormatter();
      const duration = formatter.formatDuration(150000); // 2m 30s
      assert.strictEqual(duration, '2m 30s');
    });

    it('should format hours', () => {
      const formatter = new MessageFormatter();
      const duration = formatter.formatDuration(7200000); // 2 hours
      assert.strictEqual(duration, '2h 0m');
    });

    it('should format days', () => {
      const formatter = new MessageFormatter();
      const duration = formatter.formatDuration(90000000); // 1d 1h
      assert.strictEqual(duration, '1d 1h');
    });
  });
});
