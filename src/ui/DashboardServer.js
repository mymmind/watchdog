/**
 * Dashboard Server
 * Serves web UI and provides status API
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class DashboardServer {
  constructor(config, stateManager, anomalyDetector) {
    this.config = config;
    this.stateManager = stateManager;
    this.anomalyDetector = anomalyDetector;
    this.server = null;
    this.lastCheckResults = {
      services: [],
      resources: {},
    };
  }

  /**
   * Start the dashboard server
   */
  start() {
    const port = this.config.dashboard?.port || 3100;

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(port, () => {
      logger.info(`Dashboard running at http://localhost:${port}`);
    });
  }

  /**
   * Handle incoming HTTP requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  handleRequest(req, res) {
    const { url } = req;

    try {
      if (url === '/' || url === '/index.html') {
        this.serveHTML(res);
      } else if (url === '/api/status') {
        this.serveStatus(res);
      } else if (url === '/health') {
        this.serveHealth(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (error) {
      logger.error('Dashboard request error', { error: error.message });
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  /**
   * Serve the dashboard HTML
   * @param {Object} res - HTTP response
   */
  serveHTML(res) {
    const htmlPath = path.join(__dirname, 'public', 'index.html');

    fs.readFile(htmlPath, 'utf8', (err, content) => {
      if (err) {
        logger.error('Failed to read HTML file', { error: err.message });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading dashboard');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
  }

  /**
   * Serve status API endpoint
   * @param {Object} res - HTTP response
   */
  serveStatus(res) {
    const status = this.buildStatusResponse();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(status, null, 2));
  }

  /**
   * Serve health check endpoint
   * @param {Object} res - HTTP response
   */
  serveHealth(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Build status response from current state
   * @returns {Object} - Complete status data
   */
  buildStatusResponse() {
    const services = this.getServicesStatus();
    const alerts = this.getAlertsStatus();
    const resources = this.lastCheckResults.resources || {};
    const ssl = this.getSSLStatus();

    return {
      timestamp: new Date().toISOString(),
      services,
      alerts,
      resources,
      ssl,
      stats: {
        totalServices: services.length,
        healthy: services.filter((s) => s.healthy).length,
        unhealthy: services.filter((s) => !s.healthy).length,
        activeAlerts: alerts.length,
      },
    };
  }

  /**
   * Get services status
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
        downSince: failure?.firstSeen || null,
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
        downSince: failure?.firstSeen || null,
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
        downSince: failure?.firstSeen || null,
      });
    }

    // HTTP endpoints
    for (const endpoint of config.endpoints || []) {
      const url = typeof endpoint === 'string' ? endpoint : endpoint.url;
      const serviceId = `http:${url}`;
      const failure = this.stateManager.getFailure(serviceId);
      const stats = this.anomalyDetector.getStats(serviceId);

      services.push({
        id: serviceId,
        name: url,
        type: 'http',
        healthy: !failure,
        error: failure?.error || null,
        downSince: failure?.firstSeen || null,
        responseTime: stats ? Math.round(stats.median) : null,
      });
    }

    return services;
  }

  /**
   * Get active alerts
   * @returns {Array<Object>} - Array of active alerts
   */
  getAlertsStatus() {
    const failures = this.stateManager.getAllFailures();

    return failures.map((failure) => ({
      serviceId: failure.serviceId,
      error: failure.error,
      since: failure.firstSeen,
      duration: Date.now() - failure.firstSeen,
      consecutiveFailures: failure.consecutiveFailures,
    }));
  }

  /**
   * Get SSL status
   * @returns {Array<Object>} - Array of SSL certificate statuses
   */
  getSSLStatus() {
    const endpoints = this.config.services?.endpoints || [];
    const httpsEndpoints = endpoints.filter((e) => {
      const url = typeof e === 'string' ? e : e.url;
      return url.startsWith('https://');
    });

    return httpsEndpoints.map((endpoint) => {
      const url = typeof endpoint === 'string' ? endpoint : endpoint.url;
      const serviceId = `ssl:${url}`;
      const failure = this.stateManager.getFailure(serviceId);
      const expiry = this.stateManager.getSSLExpiry(url);

      let daysRemaining = null;
      if (expiry) {
        daysRemaining = Math.floor((expiry - Date.now()) / (1000 * 60 * 60 * 24));
      }

      return {
        url,
        healthy: !failure,
        daysRemaining,
        expiry: expiry ? expiry.toISOString() : null,
        error: failure?.error || null,
      };
    });
  }

  /**
   * Update resource check results
   * Called by Monitor after resource checks
   * @param {Object} results - Resource check results
   */
  updateResourceStatus(results) {
    this.lastCheckResults.resources = {
      disk: {
        usage: results.disk?.metadata?.usage || 0,
        healthy: results.disk?.healthy || false,
        threshold: results.disk?.metadata?.threshold || 85,
      },
      ram: {
        usage: results.ram?.metadata?.usage || 0,
        healthy: results.ram?.healthy || false,
        threshold: results.ram?.metadata?.threshold || 90,
      },
      cpu: {
        usage: results.cpu?.metadata?.usage || 0,
        healthy: results.cpu?.healthy || false,
        threshold: results.cpu?.metadata?.threshold || 95,
      },
    };
  }

  /**
   * Stop the dashboard server
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        logger.info('Dashboard server stopped');
      });
    }
  }
}
