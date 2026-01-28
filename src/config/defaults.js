/**
 * Default configuration values for Watchdog
 * These can be overridden by environment variables or user config
 */

export default {
  // Check intervals (milliseconds internally)
  intervals: {
    services: 60 * 1000, // 1 minute - Docker, PM2, systemd checks
    endpoints: 300 * 1000, // 5 minutes - HTTP endpoint checks
    resources: 300 * 1000, // 5 minutes - Disk/RAM/CPU checks
    ssl: 86400 * 1000, // 24 hours - SSL certificate checks
    discovery: 300 * 1000, // 5 minutes - Service discovery scan
  },

  // Alert thresholds
  thresholds: {
    disk: 85, // percent
    ram: 90, // percent
    cpu: 95, // percent
    sslDays: 14, // days before expiry to alert
  },

  // Alert behavior
  alerts: {
    cooldownMinutes: 30, // Re-alert interval for ongoing failures
    recoveryNotify: true, // Send notification when service recovers
    flappingThreshold: 3, // Number of failures in window to detect flapping
    flappingWindowMinutes: 10, // Time window for flapping detection
  },

  // Anomaly detection settings
  anomaly: {
    enabled: true, // Enable response time anomaly detection
    multiplier: 3.0, // Alert if response > multiplier * median
    sampleSize: 20, // Number of samples to track for median calculation
  },

  // HTTP check defaults
  http: {
    timeout: 5000, // 5 seconds
    followRedirects: true,
    validateSSL: true,
  },

  // Dashboard settings
  dashboard: {
    enabled: true,
    port: 3100,
    refreshInterval: 5000, // 5 seconds - UI auto-refresh interval
  },

  // Common health check paths to try when port is discovered
  healthCheckPaths: [
    '/health',
    '/api/health',
    '/healthz',
    '/',
    '/ping',
    '/status',
  ],
};
