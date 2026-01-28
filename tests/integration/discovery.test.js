/**
 * Integration tests for Service Discovery system
 * Tests the full discovery pipeline with real service detection
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import ServiceDiscovery from '../../src/discovery/ServiceDiscovery.js';
import DiscoveredServicesWriter from '../../src/discovery/DiscoveredServicesWriter.js';
import fs from 'fs';

const TEST_OUTPUT_PATH = './test-discovered-services.yml';

describe('Service Discovery Integration', () => {
  describe('ServiceDiscovery', () => {
    it('should discover services from all available sources', async () => {
      const discovery = new ServiceDiscovery();
      const discovered = await discovery.discover();

      // Verify structure
      assert.ok(discovered);
      assert.ok(Array.isArray(discovered.docker));
      assert.ok(Array.isArray(discovered.pm2));
      assert.ok(Array.isArray(discovered.systemd));

      // Each discovered service should have required fields
      discovered.docker.forEach((service) => {
        assert.ok(service.name);
        assert.strictEqual(service.type, 'docker');
        assert.ok(service.containerName || service.containerId);
      });

      discovered.pm2.forEach((service) => {
        assert.ok(service.name);
        assert.strictEqual(service.type, 'pm2');
        assert.ok(typeof service.processId === 'number');
      });

      discovered.systemd.forEach((service) => {
        assert.ok(service.name);
        assert.strictEqual(service.type, 'systemd');
        assert.ok(service.serviceName);
      });
    });

    it('should handle discovery failures gracefully', async () => {
      const discovery = new ServiceDiscovery();

      // Discovery should never throw, even if services aren't available
      const discovered = await discovery.discover();

      assert.ok(discovered);
      assert.ok(Array.isArray(discovered.docker));
      assert.ok(Array.isArray(discovered.pm2));
      assert.ok(Array.isArray(discovered.systemd));
    });
  });

  describe('DiscoveredServicesWriter', () => {
    it('should write discovered services to YAML file', () => {
      const writer = new DiscoveredServicesWriter(TEST_OUTPUT_PATH);
      const mockDiscovered = {
        timestamp: new Date().toISOString(),
        scanDuration: 100,
        docker: [
          {
            name: 'test-container',
            type: 'docker',
            containerName: 'test-container',
            containerId: 'abc123',
            ports: ['8080:80'],
            image: 'nginx:latest',
            hasHealthCheck: true,
          },
        ],
        pm2: [
          {
            name: 'test-app',
            type: 'pm2',
            processId: 1,
            status: 'online',
            port: 3000,
            restarts: 0,
          },
        ],
        systemd: [
          {
            name: 'nginx',
            type: 'systemd',
            serviceName: 'nginx.service',
          },
        ],
        summary: {
          totalServices: 3,
          docker: 1,
          pm2: 1,
          systemd: 1,
        },
      };

      writer.write(mockDiscovered);

      // Verify file was created
      assert.ok(fs.existsSync(TEST_OUTPUT_PATH));

      // Verify file contents
      const contents = fs.readFileSync(TEST_OUTPUT_PATH, 'utf-8');
      assert.ok(contents.includes('test-container'));
      assert.ok(contents.includes('test-app'));
      assert.ok(contents.includes('nginx'));

      // Cleanup
      fs.unlinkSync(TEST_OUTPUT_PATH);
    });

    it('should create services section in YAML', () => {
      const writer = new DiscoveredServicesWriter(TEST_OUTPUT_PATH);
      const mockDiscovered = {
        timestamp: new Date().toISOString(),
        scanDuration: 50,
        docker: [{
          name: 'test',
          type: 'docker',
          containerName: 'test',
          ports: [],
          image: 'test:latest',
          hasHealthCheck: false,
        }],
        pm2: [],
        systemd: [],
        summary: {
          totalServices: 1,
          docker: 1,
          pm2: 0,
          systemd: 0,
        },
      };

      writer.write(mockDiscovered);

      const contents = fs.readFileSync(TEST_OUTPUT_PATH, 'utf-8');
      assert.ok(contents.includes('services:'));
      assert.ok(contents.includes('docker:'));

      // Cleanup
      fs.unlinkSync(TEST_OUTPUT_PATH);
    });

    it('should handle empty discovery results', () => {
      const writer = new DiscoveredServicesWriter(TEST_OUTPUT_PATH);
      const emptyDiscovered = {
        timestamp: new Date().toISOString(),
        scanDuration: 25,
        docker: [],
        pm2: [],
        systemd: [],
        summary: {
          totalServices: 0,
          docker: 0,
          pm2: 0,
          systemd: 0,
        },
      };

      writer.write(emptyDiscovered);

      // File should still be created
      assert.ok(fs.existsSync(TEST_OUTPUT_PATH));

      const contents = fs.readFileSync(TEST_OUTPUT_PATH, 'utf-8');
      assert.ok(contents.includes('services:'));

      // Cleanup
      fs.unlinkSync(TEST_OUTPUT_PATH);
    });
  });

  describe('Full Discovery Pipeline', () => {
    it('should discover and write services in one flow', async () => {
      const discovery = new ServiceDiscovery();
      const writer = new DiscoveredServicesWriter(TEST_OUTPUT_PATH);

      // Run full pipeline
      const discovered = await discovery.discover();
      writer.write(discovered);

      // Verify output file
      assert.ok(fs.existsSync(TEST_OUTPUT_PATH));

      const contents = fs.readFileSync(TEST_OUTPUT_PATH, 'utf-8');
      assert.ok(contents.includes('services:'));

      // Cleanup
      fs.unlinkSync(TEST_OUTPUT_PATH);
    });
  });
});
