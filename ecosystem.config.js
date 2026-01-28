/**
 * PM2 Ecosystem Configuration
 * Manages Watchdog process with auto-restart and monitoring
 */

module.exports = {
  apps: [{
    name: 'watchdog',
    script: 'src/index.js',
    // Node arguments
    node_args: '--experimental-modules',
    // Environment
    env: {
      NODE_ENV: 'production',
    },
    // Restart configuration
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    // Prevent watchdog from restarting too frequently if there's a persistent issue
    min_uptime: '10s',
    // Logging
    error_file: './logs/watchdog-error.log',
    out_file: './logs/watchdog-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Resource limits (optional - uncomment if needed)
    // max_memory_restart: '500M',
    // Listen for file changes in development
    watch: false,
    // Instance configuration
    instances: 1,
    exec_mode: 'fork',
  }],
};
