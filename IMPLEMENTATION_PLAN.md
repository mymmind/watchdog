# Watchdog Implementation Plan

**Project:** Watchdog - Auto-discovering Server Monitoring Tool
**Type:** Open-Source Infrastructure Monitoring
**Target:** Production-ready, secure, maintainable codebase
**Created:** 2026-01-28

## Executive Summary

Watchdog is an open-source server monitoring tool that automatically discovers services running on a system (Docker containers, PM2 processes, systemd services) and monitors their health. It sends Telegram alerts when issues are detected and provides a clean web dashboard for visual monitoring.

### Key Features
- **Auto-discovery:** Automatically finds and monitors services without manual configuration
- **Smart alerting:** Flapping detection, cooldown periods, anomaly detection
- **Multi-channel monitoring:** Docker, PM2, systemd, HTTP endpoints, SSL certificates, system resources
- **Anomaly detection:** Response time tracking to catch performance degradation
- **SSL monitoring:** Certificate expiry warnings (14 days before expiration)
- **Simple web UI:** Read-only status dashboard with auto-refresh
- **User overrides:** Optional YAML config for customization

### Technology Stack
- **Runtime:** Node.js 20+ with ES modules
- **Process Manager:** PM2
- **Dependencies:** Only 3 external packages (node-telegram-bot-api, node-cron, dotenv)
- **Config Format:** YAML for user configs, JSON for state persistence
- **UI:** Vanilla HTML/CSS/JS (no frameworks)

### Design Principles
1. **Security-first:** Command injection prevention, secrets management, least privilege
2. **Clean architecture:** Single responsibility, dependency injection, no god objects
3. **Fail-safe:** One checker failure doesn't crash the system
4. **YAGNI:** Only build what's needed, avoid over-engineering
5. **Open-source ready:** Comprehensive docs, tests, contribution guidelines

---

## Phase 1: Project Setup & Infrastructure

**Goal:** Establish project foundation with proper tooling, structure, and utilities.

### Task 1.1: Initialize Node.js Project with ES Modules

**What to do:**
- Create `package.json` with `"type": "module"` for ES module support
- Set Node.js version requirement to `>=20.0.0`
- Create base directory structure:
  ```
  watchdog/
  ├── src/
  ├── tests/
  ├── docs/
  ├── config/
  └── .github/
  ```

**Acceptance criteria:**
- `package.json` exists with correct module type
- Directory structure matches the plan
- Can run basic ES module imports

### Task 1.2: Set Up package.json with Dependencies

**What to do:**
Create `package.json` with the following structure:

```json
{
  "name": "watchdog",
  "version": "1.0.0",
  "type": "module",
  "description": "Auto-discovering server monitoring tool with Telegram alerts",
  "main": "src/index.js",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --test tests/**/*.test.js",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.66.0",
    "node-cron": "^3.0.3",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "eslint": "^8.57.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-plugin-import": "^2.29.1",
    "husky": "^9.0.0"
  },
  "keywords": ["monitoring", "devops", "alerts", "telegram", "docker", "pm2"],
  "author": "",
  "license": "MIT"
}
```

**Acceptance criteria:**
- `npm install` runs successfully
- All 3 core dependencies installed
- Dev dependencies for linting installed

### Task 1.3: Create Config Templates

**What to do:**
1. Create `.env.example`:
```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# Check Intervals (seconds)
CHECK_INTERVAL_SERVICES=60
CHECK_INTERVAL_ENDPOINTS=300
CHECK_INTERVAL_RESOURCES=300
CHECK_INTERVAL_SSL=86400
CHECK_INTERVAL_DISCOVERY=300

# Alert Thresholds
DISK_THRESHOLD_PERCENT=85
RAM_THRESHOLD_PERCENT=90
CPU_THRESHOLD_PERCENT=95

# Alert Behavior
ALERT_COOLDOWN_MINUTES=30
RECOVERY_NOTIFY=true
FLAPPING_THRESHOLD=3
FLAPPING_WINDOW_MINUTES=10

# Dashboard
DASHBOARD_PORT=3100
DASHBOARD_ENABLED=true

# Anomaly Detection
ANOMALY_DETECTION_ENABLED=true
ANOMALY_MULTIPLIER=3.0
ANOMALY_SAMPLE_SIZE=20
```

2. Create `.gitignore`:
```
# Environment
.env
node_modules/

# State files
state.json
discovered-services.yml

# Logs
logs/
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Testing
coverage/
.nyc_output/
```

**Acceptance criteria:**
- `.env.example` documents all configuration options
- `.gitignore` prevents committing sensitive files
- Running app won't commit secrets or state

### Task 1.4: Set Up ESLint with Airbnb Style Guide

**What to do:**
1. Create `.eslintrc.json`:
```json
{
  "env": {
    "es2024": true,
    "node": true
  },
  "extends": "airbnb-base",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-console": "off",
    "import/extensions": ["error", "always"],
    "class-methods-use-this": "off",
    "no-restricted-syntax": "off",
    "max-len": ["error", { "code": 100, "ignoreUrls": true }]
  }
}
```

2. Set up Husky pre-commit hook:
```bash
npx husky init
echo "npm run lint" > .husky/pre-commit
```

**Acceptance criteria:**
- `npm run lint` runs without errors on empty src/
- Pre-commit hook blocks commits with lint errors
- Airbnb style rules enforced

### Task 1.5: Create utils/logger.js

**What to do:**
Create a structured logger that:
- Logs with timestamps
- Supports log levels (debug, info, warn, error)
- Never logs sensitive data (tokens, passwords)
- Outputs to console with color coding
- Can be easily extended to file logging later

```javascript
// src/utils/logger.js
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
};

class Logger {
  constructor(minLevel = 'info') {
    this.minLevel = LOG_LEVELS[minLevel] || LOG_LEVELS.info;
  }

  log(level, message, meta = {}) {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const color = COLORS[level] || COLORS.reset;
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';

    console.log(
      `${color}[${timestamp}] [${level.toUpperCase()}]${COLORS.reset} ${message} ${metaStr}`
    );
  }

  debug(message, meta) { this.log('debug', message, meta); }
  info(message, meta) { this.log('info', message, meta); }
  warn(message, meta) { this.log('warn', message, meta); }
  error(message, meta) { this.log('error', message, meta); }
}

export default new Logger(process.env.LOG_LEVEL || 'info');
```

**Acceptance criteria:**
- Logger supports all 4 levels
- Color-coded output in terminal
- Can filter by minimum log level
- No sensitive data in logs

### Task 1.6: Create utils/exec.js

**What to do:**
Create a safe command execution wrapper that prevents command injection:

```javascript
// src/utils/exec.js
import { execSync } from 'child_process';
import logger from './logger.js';

// Whitelist of allowed commands
const ALLOWED_COMMANDS = [
  'docker',
  'pm2',
  'systemctl',
  'df',
  'free',
  'top',
  'redis-cli',
  'pg_isready',
];

/**
 * Safely execute a shell command
 * @param {string} command - Command name (must be whitelisted)
 * @param {string[]} args - Arguments (will be sanitized)
 * @param {Object} options - exec options
 * @returns {string} - Command output
 */
export function safeExec(command, args = [], options = {}) {
  // Validate command is whitelisted
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }

  // Sanitize arguments - reject anything with command injection attempts
  const sanitizedArgs = args.map((arg) => {
    if (typeof arg !== 'string') {
      throw new Error('All arguments must be strings');
    }
    // Reject args with shell metacharacters
    if (/[;&|`$()]/.test(arg)) {
      throw new Error(`Potentially unsafe argument: ${arg}`);
    }
    return arg;
  });

  const fullCommand = [command, ...sanitizedArgs].join(' ');

  try {
    logger.debug(`Executing: ${fullCommand}`);
    const result = execSync(fullCommand, {
      encoding: 'utf8',
      timeout: options.timeout || 10000,
      maxBuffer: options.maxBuffer || 1024 * 1024, // 1MB
      ...options,
    });
    return result.trim();
  } catch (error) {
    logger.error(`Command failed: ${fullCommand}`, { error: error.message });
    throw error;
  }
}

/**
 * Execute command and return true if successful, false if failed
 */
export function safeExecBool(command, args = [], options = {}) {
  try {
    safeExec(command, args, options);
    return true;
  } catch {
    return false;
  }
}
```

**Acceptance criteria:**
- Only whitelisted commands can execute
- Arguments are sanitized for shell metacharacters
- Throws on command injection attempts
- Timeout protection on all commands
- Returns trimmed output or boolean

### Task 1.7: Create utils/CircularBuffer.js

**What to do:**
Create a fixed-size circular buffer for storing response time samples:

```javascript
// src/utils/CircularBuffer.js

/**
 * Fixed-size circular buffer for efficient rolling window storage
 */
export default class CircularBuffer {
  constructor(size) {
    this.size = size;
    this.buffer = new Array(size);
    this.index = 0;
    this.count = 0;
  }

  /**
   * Add a value to the buffer
   */
  push(value) {
    this.buffer[this.index] = value;
    this.index = (this.index + 1) % this.size;
    if (this.count < this.size) {
      this.count += 1;
    }
  }

  /**
   * Get all values in chronological order
   */
  getAll() {
    if (this.count < this.size) {
      return this.buffer.slice(0, this.count);
    }
    return [
      ...this.buffer.slice(this.index),
      ...this.buffer.slice(0, this.index),
    ];
  }

  /**
   * Get median value (for anomaly detection)
   */
  getMedian() {
    const values = this.getAll().sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  }

  /**
   * Get average value
   */
  getAverage() {
    const values = this.getAll();
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Check if buffer is full
   */
  isFull() {
    return this.count === this.size;
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = new Array(this.size);
    this.index = 0;
    this.count = 0;
  }
}
```

**Acceptance criteria:**
- Fixed-size buffer (doesn't grow unbounded)
- Efficient O(1) push operation
- getMedian() for anomaly detection
- getAll() returns values in chronological order

---

## Phase 2: Configuration System

**Goal:** Build flexible configuration system that merges discovered services with user overrides.

### Task 2.1: Create config/defaults.js

**What to do:**
Define all default values in a central location:

```javascript
// src/config/defaults.js

export default {
  // Check intervals (milliseconds internally)
  intervals: {
    services: 60 * 1000,      // 1 minute
    endpoints: 300 * 1000,    // 5 minutes
    resources: 300 * 1000,    // 5 minutes
    ssl: 86400 * 1000,        // 24 hours
    discovery: 300 * 1000,    // 5 minutes
  },

  // Alert thresholds
  thresholds: {
    disk: 85,       // percent
    ram: 90,        // percent
    cpu: 95,        // percent
    sslDays: 14,    // days before expiry
  },

  // Alert behavior
  alerts: {
    cooldownMinutes: 30,
    recoveryNotify: true,
    flappingThreshold: 3,       // failures in window
    flappingWindowMinutes: 10,
  },

  // Anomaly detection
  anomaly: {
    enabled: true,
    multiplier: 3.0,    // Alert if response > 3x median
    sampleSize: 20,     // Track last 20 samples
  },

  // HTTP check defaults
  http: {
    timeout: 5000,      // 5 seconds
    followRedirects: true,
    validateSSL: true,
  },

  // Dashboard
  dashboard: {
    enabled: true,
    port: 3100,
    refreshInterval: 5000,  // 5 seconds
  },

  // Common health check paths to try
  healthCheckPaths: ['/health', '/api/health', '/', '/ping', '/status'],
};
```

**Acceptance criteria:**
- All configurable values defined
- Reasonable defaults that work out of the box
- Well-commented with units

### Task 2.2: Create config/ConfigLoader.js

**What to do:**
Build a config loader that:
1. Loads environment variables from `.env`
2. Loads optional `watchdog.config.yml`
3. Merges with defaults
4. Validates configuration
5. Returns final config object

```javascript
// src/config/ConfigLoader.js
import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml'; // Add yaml package
import dotenv from 'dotenv';
import defaults from './defaults.js';
import logger from '../utils/logger.js';

export default class ConfigLoader {
  constructor(configPath = './watchdog.config.yml') {
    this.configPath = configPath;
  }

  /**
   * Load environment variables
   */
  loadEnv() {
    dotenv.config();

    return {
      telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
      },
      intervals: {
        services: parseInt(process.env.CHECK_INTERVAL_SERVICES || '60', 10) * 1000,
        endpoints: parseInt(process.env.CHECK_INTERVAL_ENDPOINTS || '300', 10) * 1000,
        resources: parseInt(process.env.CHECK_INTERVAL_RESOURCES || '300', 10) * 1000,
        ssl: parseInt(process.env.CHECK_INTERVAL_SSL || '86400', 10) * 1000,
        discovery: parseInt(process.env.CHECK_INTERVAL_DISCOVERY || '300', 10) * 1000,
      },
      thresholds: {
        disk: parseInt(process.env.DISK_THRESHOLD_PERCENT || '85', 10),
        ram: parseInt(process.env.RAM_THRESHOLD_PERCENT || '90', 10),
        cpu: parseInt(process.env.CPU_THRESHOLD_PERCENT || '95', 10),
      },
      alerts: {
        cooldownMinutes: parseInt(process.env.ALERT_COOLDOWN_MINUTES || '30', 10),
        recoveryNotify: process.env.RECOVERY_NOTIFY !== 'false',
      },
      dashboard: {
        enabled: process.env.DASHBOARD_ENABLED !== 'false',
        port: parseInt(process.env.DASHBOARD_PORT || '3100', 10),
      },
      anomaly: {
        enabled: process.env.ANOMALY_DETECTION_ENABLED !== 'false',
        multiplier: parseFloat(process.env.ANOMALY_MULTIPLIER || '3.0'),
        sampleSize: parseInt(process.env.ANOMALY_SAMPLE_SIZE || '20', 10),
      },
    };
  }

  /**
   * Load user config from YAML file (if exists)
   */
  loadUserConfig() {
    if (!fs.existsSync(this.configPath)) {
      logger.info('No user config found, using discovered services only');
      return {};
    }

    try {
      const yamlContent = fs.readFileSync(this.configPath, 'utf8');
      const userConfig = parseYaml(yamlContent);
      logger.info('Loaded user configuration', { path: this.configPath });
      return userConfig;
    } catch (error) {
      logger.error('Failed to parse user config', { error: error.message });
      throw new Error(`Invalid YAML in ${this.configPath}: ${error.message}`);
    }
  }

  /**
   * Validate required configuration
   */
  validate(config) {
    if (!config.telegram?.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required in .env');
    }
    if (!config.telegram?.chatId) {
      throw new Error('TELEGRAM_CHAT_ID is required in .env');
    }
    return true;
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && key in target) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * Load complete configuration
   */
  load() {
    const envConfig = this.loadEnv();
    const userConfig = this.loadUserConfig();

    // Merge: defaults < env < user config
    let config = this.deepMerge(defaults, envConfig);
    config = this.deepMerge(config, userConfig);

    this.validate(config);

    logger.info('Configuration loaded successfully');
    return config;
  }
}
```

**Note:** Need to add `yaml` package to dependencies:
```bash
npm install yaml
```

**Acceptance criteria:**
- Loads .env variables
- Loads optional YAML config
- Merges correctly (user config > env > defaults)
- Validates required fields
- Throws helpful errors on misconfiguration

### Task 2.3: Add YAML Schema Validation

**What to do:**
Add schema validation to ensure user config has valid structure:

```javascript
// src/config/schema.js

/**
 * Validate user config structure
 */
export function validateUserConfig(config) {
  const errors = [];

  // Validate overrides structure
  if (config.overrides) {
    if (typeof config.overrides !== 'object') {
      errors.push('overrides must be an object');
    }

    // Validate Docker overrides
    if (config.overrides.docker) {
      for (const [name, opts] of Object.entries(config.overrides.docker)) {
        if (opts.httpCheck && typeof opts.httpCheck !== 'string') {
          errors.push(`overrides.docker.${name}.httpCheck must be a string`);
        }
      }
    }
  }

  // Validate ignore list
  if (config.ignore && !Array.isArray(config.ignore)) {
    errors.push('ignore must be an array of service names');
  }

  // Validate endpoints
  if (config.endpoints) {
    if (!Array.isArray(config.endpoints)) {
      errors.push('endpoints must be an array');
    } else {
      config.endpoints.forEach((endpoint, i) => {
        if (typeof endpoint === 'string') return; // Just URL is fine
        if (typeof endpoint === 'object') {
          if (!endpoint.url) {
            errors.push(`endpoints[${i}] must have a url property`);
          }
          if (endpoint.checkSSL !== undefined && typeof endpoint.checkSSL !== 'boolean') {
            errors.push(`endpoints[${i}].checkSSL must be boolean`);
          }
        } else {
          errors.push(`endpoints[${i}] must be string or object`);
        }
      });
    }
  }

  // Validate thresholds
  if (config.thresholds) {
    const validThresholds = ['disk', 'ram', 'cpu', 'sslDays'];
    for (const [key, value] of Object.entries(config.thresholds)) {
      if (!validThresholds.includes(key)) {
        errors.push(`Unknown threshold: ${key}`);
      }
      if (typeof value !== 'number' || value < 0 || value > 100) {
        errors.push(`thresholds.${key} must be a number between 0-100`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n${errors.join('\n')}`);
  }

  return true;
}
```

Update ConfigLoader to use schema validation:
```javascript
// In ConfigLoader.loadUserConfig(), after parsing YAML:
import { validateUserConfig } from './schema.js';

const userConfig = parseYaml(yamlContent);
validateUserConfig(userConfig); // Validate before returning
return userConfig;
```

**Acceptance criteria:**
- Validates config structure
- Provides helpful error messages
- Prevents invalid configs from being used

### Task 2.4: Create watchdog.config.example.yml

**What to do:**
Create a well-documented example config file:

```yaml
# Watchdog User Configuration Example
# This file is optional - Watchdog will auto-discover services without it
# Use this to override discovered settings or add external endpoints

# Override settings for discovered services
overrides:
  docker:
    my-app:
      httpCheck: http://localhost:3000/api/health  # Custom health endpoint
      expectedStatus: 200

  pm2:
    api-server:
      httpCheck: http://localhost:8080/health

  systemd:
    nginx:
      enabled: true  # Explicitly enable monitoring

# Services to ignore (won't be monitored even if discovered)
ignore:
  - test-container
  - dev-database

# External endpoints to monitor (can't be auto-discovered)
endpoints:
  - url: https://example.com
    name: My Website
    checkSSL: true
    expectedStatus: 200

  - url: https://api.example.com/health
    name: API Health Check
    checkSSL: true

# Override default thresholds
thresholds:
  disk: 85    # Alert when disk usage > 85%
  ram: 90     # Alert when RAM usage > 90%
  cpu: 95     # Alert when CPU usage > 95%
  sslDays: 14 # Alert when SSL cert expires in 14 days

# Alert behavior overrides
alerts:
  cooldownMinutes: 30      # Re-alert every 30 minutes for ongoing issues
  recoveryNotify: true     # Send notification when service recovers
  flappingThreshold: 3     # Consider service "flapping" after 3 transitions
  flappingWindowMinutes: 10

# Anomaly detection settings
anomaly:
  enabled: true
  multiplier: 3.0    # Alert if response time > 3x median
  sampleSize: 20     # Track last 20 response time samples

# Dashboard settings
dashboard:
  enabled: true
  port: 3100
```

**Acceptance criteria:**
- Every option is documented with comments
- Shows examples of common use cases
- Valid YAML that passes schema validation

---

## Phase 3: Auto-Discovery System

**Goal:** Build the auto-discovery engine that finds running services.

### Task 3.1: Create discovery/DockerDiscovery.js

**What to do:**
Discover all Docker containers with their health status and ports:

```javascript
// src/discovery/DockerDiscovery.js
import { safeExec, safeExecBool } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class DockerDiscovery {
  /**
   * Check if Docker is available
   */
  isAvailable() {
    return safeExecBool('docker', ['--version']);
  }

  /**
   * Discover all running Docker containers
   */
  discover() {
    if (!this.isAvailable()) {
      logger.warn('Docker not available, skipping container discovery');
      return [];
    }

    try {
      // Get all containers in JSON format
      const output = safeExec('docker', [
        'ps',
        '--format',
        '{{json .}}',
      ]);

      const lines = output.split('\n').filter((line) => line.trim());
      const containers = lines.map((line) => JSON.parse(line));

      return containers.map((container) => this.parseContainer(container));
    } catch (error) {
      logger.error('Docker discovery failed', { error: error.message });
      return [];
    }
  }

  /**
   * Parse container info and extract useful metadata
   */
  parseContainer(container) {
    const ports = this.extractPorts(container.Ports);
    const hasHealthCheck = this.hasHealthCheck(container.Names);

    return {
      type: 'docker',
      name: container.Names,
      id: container.ID,
      status: container.Status,
      ports,
      hasHealthCheck,
      image: container.Image,
    };
  }

  /**
   * Extract port mappings from Docker ps output
   * Example: "0.0.0.0:3000->3000/tcp" => [3000]
   */
  extractPorts(portString) {
    if (!portString) return [];

    const portRegex = /0\.0\.0\.0:(\d+)->/g;
    const ports = [];
    let match;

    while ((match = portRegex.exec(portString)) !== null) {
      ports.push(parseInt(match[1], 10));
    }

    return ports;
  }

  /**
   * Check if container has a health check defined
   */
  hasHealthCheck(containerName) {
    try {
      const health = safeExec('docker', [
        'inspect',
        '--format',
        '{{.State.Health.Status}}',
        containerName,
      ]);
      return health !== '<no value>';
    } catch {
      return false;
    }
  }
}
```

**Acceptance criteria:**
- Discovers all running containers
- Extracts port mappings
- Detects if container has health check
- Handles Docker not being installed
- Returns empty array on error (doesn't crash)

### Task 3.2: Create discovery/PM2Discovery.js

**What to do:**
Discover PM2 processes and extract metadata:

```javascript
// src/discovery/PM2Discovery.js
import { safeExec, safeExecBool } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class PM2Discovery {
  /**
   * Check if PM2 is available
   */
  isAvailable() {
    return safeExecBool('pm2', ['--version']);
  }

  /**
   * Discover all PM2 processes
   */
  discover() {
    if (!this.isAvailable()) {
      logger.warn('PM2 not available, skipping process discovery');
      return [];
    }

    try {
      const output = safeExec('pm2', ['jlist']);
      const processes = JSON.parse(output);

      return processes.map((proc) => this.parseProcess(proc));
    } catch (error) {
      logger.error('PM2 discovery failed', { error: error.message });
      return [];
    }
  }

  /**
   * Parse PM2 process info
   */
  parseProcess(proc) {
    const port = this.extractPort(proc);

    return {
      type: 'pm2',
      name: proc.name,
      pid: proc.pid,
      status: proc.pm2_env?.status || 'unknown',
      restarts: proc.pm2_env?.restart_time || 0,
      uptime: proc.pm2_env?.pm_uptime,
      port,
      script: proc.pm2_env?.pm_exec_path,
    };
  }

  /**
   * Try to extract port from environment variables or script args
   * Common patterns: PORT=3000, --port 3000, -p 3000
   */
  extractPort(proc) {
    // Check environment variables
    const env = proc.pm2_env?.env || {};
    if (env.PORT) {
      return parseInt(env.PORT, 10);
    }

    // Check command line args
    const args = proc.pm2_env?.args || [];
    for (let i = 0; i < args.length; i += 1) {
      if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
        return parseInt(args[i + 1], 10);
      }
    }

    return null;
  }
}
```

**Acceptance criteria:**
- Discovers all PM2 processes
- Extracts status and restart count
- Attempts to find port number
- Handles PM2 not installed
- Returns empty array on error

### Task 3.3: Create discovery/SystemdDiscovery.js

**What to do:**
Discover systemd services:

```javascript
// src/discovery/SystemdDiscovery.js
import { safeExec, safeExecBool } from '../utils/exec.js';
import logger from '../utils/logger.js';

export default class SystemdDiscovery {
  /**
   * Check if systemctl is available
   */
  isAvailable() {
    return safeExecBool('systemctl', ['--version']);
  }

  /**
   * Discover running systemd services
   * Only include "interesting" services (not system internals)
   */
  discover() {
    if (!this.isAvailable()) {
      logger.warn('systemd not available, skipping service discovery');
      return [];
    }

    try {
      const output = safeExec('systemctl', [
        'list-units',
        '--type=service',
        '--state=running',
        '--no-pager',
        '--plain',
      ]);

      const lines = output.split('\n').filter((line) => line.trim());
      const services = [];

      // Skip header and footer lines
      for (const line of lines) {
        if (line.includes('.service')) {
          const parts = line.trim().split(/\s+/);
          const serviceName = parts[0];

          // Filter out system services (keep user-installed ones)
          if (this.isInterestingService(serviceName)) {
            services.push({
              type: 'systemd',
              name: serviceName,
              status: 'running',
            });
          }
        }
      }

      return services;
    } catch (error) {
      logger.error('systemd discovery failed', { error: error.message });
      return [];
    }
  }

  /**
   * Filter to only interesting services (not system internals)
   */
  isInterestingService(name) {
    const interestingPrefixes = [
      'nginx',
      'apache',
      'postgresql',
      'mysql',
      'mariadb',
      'redis',
      'mongodb',
      'docker',
      'fail2ban',
    ];

    return interestingPrefixes.some((prefix) => name.startsWith(prefix));
  }
}
```

**Acceptance criteria:**
- Discovers running systemd services
- Filters out boring system services
- Only includes user-relevant services
- Handles systemd not available (e.g., macOS)

### Task 3.4: Create discovery/ServiceDiscovery.js Orchestrator

**What to do:**
Orchestrate all discoverers and merge results:

```javascript
// src/discovery/ServiceDiscovery.js
import DockerDiscovery from './DockerDiscovery.js';
import PM2Discovery from './PM2Discovery.js';
import SystemdDiscovery from './SystemdDiscovery.js';
import logger from '../utils/logger.js';

export default class ServiceDiscovery {
  constructor() {
    this.dockerDiscovery = new DockerDiscovery();
    this.pm2Discovery = new PM2Discovery();
    this.systemdDiscovery = new SystemdDiscovery();
  }

  /**
   * Run all discovery methods and merge results
   */
  async discover() {
    logger.info('Starting service discovery...');

    const [docker, pm2, systemd] = await Promise.all([
      Promise.resolve(this.dockerDiscovery.discover()),
      Promise.resolve(this.pm2Discovery.discover()),
      Promise.resolve(this.systemdDiscovery.discover()),
    ]);

    const discovered = {
      timestamp: new Date().toISOString(),
      docker,
      pm2,
      systemd,
      summary: {
        totalServices: docker.length + pm2.length + systemd.length,
        docker: docker.length,
        pm2: pm2.length,
        systemd: systemd.length,
      },
    };

    logger.info('Service discovery complete', discovered.summary);
    return discovered;
  }

  /**
   * Get flat list of all discovered services
   */
  async discoverFlat() {
    const discovered = await this.discover();
    return [
      ...discovered.docker,
      ...discovered.pm2,
      ...discovered.systemd,
    ];
  }
}
```

**Acceptance criteria:**
- Runs all discoverers in parallel
- Returns structured result with metadata
- Logs summary of what was found
- Never throws (catches all errors)

### Task 3.5: Implement discovered-services.yml Generation

**What to do:**
Auto-generate YAML file showing discovered services:

```javascript
// src/discovery/DiscoveredServicesWriter.js
import fs from 'fs';
import { stringify as stringifyYaml } from 'yaml';
import logger from '../utils/logger.js';

export default class DiscoveredServicesWriter {
  constructor(outputPath = './discovered-services.yml') {
    this.outputPath = outputPath;
  }

  /**
   * Write discovered services to YAML file
   */
  write(discovered) {
    try {
      const yamlContent = this.generateYaml(discovered);
      fs.writeFileSync(this.outputPath, yamlContent, 'utf8');
      logger.info('Updated discovered services file', {
        path: this.outputPath,
        services: discovered.summary.totalServices,
      });
    } catch (error) {
      logger.error('Failed to write discovered services', {
        error: error.message,
      });
    }
  }

  /**
   * Generate YAML content with helpful comments
   */
  generateYaml(discovered) {
    const header = `# Auto-generated by Watchdog
# Last scan: ${discovered.timestamp}
# Total services: ${discovered.summary.totalServices}
#
# This file shows what Watchdog discovered on your system.
# To customize monitoring, create 'watchdog.config.yml'
#
`;

    const data = {
      discovered: {
        docker: discovered.docker.map((c) => ({
          name: c.name,
          ports: c.ports,
          hasHealthCheck: c.hasHealthCheck,
          image: c.image,
        })),
        pm2: discovered.pm2.map((p) => ({
          name: p.name,
          status: p.status,
          port: p.port,
          restarts: p.restarts,
        })),
        systemd: discovered.systemd.map((s) => s.name),
      },
    };

    return header + stringifyYaml(data);
  }
}
```

**Acceptance criteria:**
- Generates valid YAML
- Includes helpful header comments
- Shows all discovered services
- Overwrites file on each discovery run

### Task 3.6: Add Config Merge Logic

**What to do:**
Update ConfigLoader to merge discovered services with user overrides:

```javascript
// Add to src/config/ConfigLoader.js

/**
 * Load discovered services from file
 */
loadDiscoveredServices() {
  const discoveredPath = './discovered-services.yml';
  if (!fs.existsSync(discoveredPath)) {
    logger.info('No discovered services file found yet');
    return { docker: [], pm2: [], systemd: [] };
  }

  try {
    const yamlContent = fs.readFileSync(discoveredPath, 'utf8');
    const data = parseYaml(yamlContent);
    return data.discovered || { docker: [], pm2: [], systemd: [] };
  } catch (error) {
    logger.error('Failed to load discovered services', { error: error.message });
    return { docker: [], pm2: [], systemd: [] };
  }
}

/**
 * Merge discovered services with user config
 */
mergeServices(discovered, userConfig) {
  const services = {
    docker: [],
    pm2: [],
    systemd: [],
    endpoints: userConfig.endpoints || [],
  };

  // Process Docker containers
  for (const container of discovered.docker) {
    // Skip if in ignore list
    if (userConfig.ignore?.includes(container.name)) {
      continue;
    }

    // Apply user overrides
    const override = userConfig.overrides?.docker?.[container.name] || {};
    services.docker.push({ ...container, ...override });
  }

  // Process PM2 processes
  for (const process of discovered.pm2) {
    if (userConfig.ignore?.includes(process.name)) {
      continue;
    }

    const override = userConfig.overrides?.pm2?.[process.name] || {};
    services.pm2.push({ ...process, ...override });
  }

  // Process systemd services
  for (const service of discovered.systemd) {
    if (userConfig.ignore?.includes(service)) {
      continue;
    }

    const override = userConfig.overrides?.systemd?.[service] || {};
    services.systemd.push({ name: service, ...override });
  }

  return services;
}
```

Update the `load()` method to include service merging:
```javascript
load() {
  const envConfig = this.loadEnv();
  const userConfig = this.loadUserConfig();
  const discovered = this.loadDiscoveredServices();

  // Merge configs
  let config = this.deepMerge(defaults, envConfig);
  config = this.deepMerge(config, userConfig);

  // Merge services
  config.services = this.mergeServices(discovered, userConfig);

  this.validate(config);

  logger.info('Configuration loaded successfully', {
    services: config.services.docker.length + config.services.pm2.length +
              config.services.systemd.length + config.services.endpoints.length,
  });

  return config;
}
```

**Acceptance criteria:**
- Loads discovered-services.yml
- Respects ignore list
- Applies user overrides
- Merges endpoints from user config
- Final config has complete service list

---

## Phase 4: Health Checkers

**Goal:** Implement all health check modules with consistent interface.

### Task 4.1: Create checkers/HealthChecker.js Base Class

**What to do:**
Define interface that all checkers implement:

```javascript
// src/checkers/HealthChecker.js

/**
 * Base class for all health checkers
 * All checkers must implement the check() method
 */
export default class HealthChecker {
  constructor(config) {
    this.config = config;
  }

  /**
   * Perform health check
   * @returns {Promise<HealthCheckResult>}
   */
  async check() {
    throw new Error('check() must be implemented by subclass');
  }
}

/**
 * @typedef {Object} HealthCheckResult
 * @property {boolean} healthy - Is the service healthy?
 * @property {number} responseTime - Check duration in milliseconds
 * @property {string|null} error - Error message if unhealthy
 * @property {Object} metadata - Additional checker-specific data
 */
```

**Acceptance criteria:**
- Base class with clear interface
- JSDoc type definitions
- Throws if check() not implemented

### Task 4.2-4.7: Implement Individual Checkers

I'll provide the full implementation for each checker. Due to length, here's the structure:

**Task 4.2: DockerChecker**
- Uses `docker inspect` for container state
- Checks health status if available
- Falls back to HTTP ping if port exposed
- Returns container status and uptime

**Task 4.3: PM2Checker**
- Parses `pm2 jlist` for process status
- Checks if status is 'online'
- Tracks restart count
- Optional HTTP check if port known

**Task 4.4: SystemdChecker**
- Uses `systemctl is-active <service>`
- Fast boolean check
- Returns active/inactive/failed status

**Task 4.5: HTTPChecker**
- Native fetch with timeout
- Records response time
- Validates status code
- Follows redirects (configurable)
- Returns response time for anomaly detection

**Task 4.6: ResourceChecker**
- Disk: `df -h` for usage percentage
- RAM: `free` for memory stats
- CPU: `top -bn1` for load average
- Caches results for 60 seconds

**Task 4.7: SSLChecker**
- Opens TLS connection to domain
- Extracts certificate
- Checks expiry date
- Returns days until expiration

Each checker follows the same pattern:
```javascript
import HealthChecker from './HealthChecker.js';

export default class XxxChecker extends HealthChecker {
  async check(service) {
    const startTime = Date.now();

    try {
      // Perform check logic
      const result = await this.performCheck(service);

      return {
        healthy: result.isHealthy,
        responseTime: Date.now() - startTime,
        error: null,
        metadata: result.metadata,
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error.message,
        metadata: {},
      };
    }
  }
}
```

**Acceptance criteria (all checkers):**
- Implements HealthChecker interface
- Returns consistent result format
- Never throws (catches all errors)
- Includes response time
- Has unit tests with mocks

---

## Phase 5: State Management & Monitoring

**Goal:** Build stateful monitoring system with smart alerting.

### Task 5.1: Create monitoring/StateManager.js

**What to do:**
Build state tracker that prevents alert spam:

```javascript
// src/monitoring/StateManager.js
import fs from 'fs';
import logger from '../utils/logger.js';

export default class StateManager {
  constructor(statePath = './state.json') {
    this.statePath = statePath;
    this.state = {
      failures: new Map(),     // serviceId -> failure info
      flapping: new Map(),     // serviceId -> state transitions
      acknowledged: new Set(), // serviceId -> manually muted
      sslExpiry: new Map(),    // domain -> expiry date
    };
    this.load();
  }

  /**
   * Load state from disk
   */
  load() {
    if (!fs.existsSync(this.statePath)) {
      logger.info('No existing state file, starting fresh');
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));

      // Restore Maps and Sets from JSON
      this.state.failures = new Map(data.failures || []);
      this.state.flapping = new Map(data.flapping || []);
      this.state.acknowledged = new Set(data.acknowledged || []);
      this.state.sslExpiry = new Map(data.sslExpiry || []);

      logger.info('State loaded from disk', {
        failures: this.state.failures.size,
        flapping: this.state.flapping.size,
      });
    } catch (error) {
      logger.error('Failed to load state', { error: error.message });
    }
  }

  /**
   * Save state to disk
   */
  save() {
    try {
      const data = {
        failures: Array.from(this.state.failures.entries()),
        flapping: Array.from(this.state.flapping.entries()),
        acknowledged: Array.from(this.state.acknowledged),
        sslExpiry: Array.from(this.state.sslExpiry.entries()),
        lastSaved: new Date().toISOString(),
      };

      fs.writeFileSync(this.statePath, JSON.stringify(data, null, 2), 'utf8');
      logger.debug('State saved to disk');
    } catch (error) {
      logger.error('Failed to save state', { error: error.message });
    }
  }

  /**
   * Record a service failure
   */
  recordFailure(serviceId, error) {
    const now = Date.now();
    const existing = this.state.failures.get(serviceId);

    if (!existing) {
      // First failure
      this.state.failures.set(serviceId, {
        firstSeen: now,
        lastAlertSent: now,
        error,
        consecutiveFailures: 1,
      });
      return 'first_failure';
    }

    // Ongoing failure
    existing.consecutiveFailures += 1;
    existing.error = error;
    this.state.failures.set(serviceId, existing);

    // Check if we should re-alert
    const minutesSinceLastAlert = (now - existing.lastAlertSent) / 1000 / 60;
    const cooldown = this.config?.alerts?.cooldownMinutes || 30;

    if (minutesSinceLastAlert >= cooldown) {
      existing.lastAlertSent = now;
      return 'ongoing_failure';
    }

    return 'suppressed';
  }

  /**
   * Record a service recovery
   */
  recordRecovery(serviceId) {
    const failure = this.state.failures.get(serviceId);
    if (!failure) return null;

    const downtime = Date.now() - failure.firstSeen;
    this.state.failures.delete(serviceId);

    return {
      downtimeDuration: downtime,
      failuresSeen: failure.consecutiveFailures,
    };
  }

  /**
   * Track state transitions for flapping detection
   */
  recordStateChange(serviceId, newState) {
    const now = Date.now();
    const transitions = this.state.flapping.get(serviceId) || [];

    transitions.push({ time: now, state: newState });

    // Keep only last 10 transitions
    if (transitions.length > 10) {
      transitions.shift();
    }

    this.state.flapping.set(serviceId, transitions);

    // Check for flapping
    return this.isFlapping(serviceId);
  }

  /**
   * Detect if service is flapping
   * Flapping = 3+ state changes in 10 minutes
   */
  isFlapping(serviceId) {
    const transitions = this.state.flapping.get(serviceId) || [];
    if (transitions.length < 3) return false;

    const threshold = this.config?.alerts?.flappingThreshold || 3;
    const windowMs = (this.config?.alerts?.flappingWindowMinutes || 10) * 60 * 1000;
    const now = Date.now();

    // Count transitions in window
    const recentTransitions = transitions.filter((t) => now - t.time < windowMs);
    return recentTransitions.length >= threshold;
  }

  /**
   * Check if service is acknowledged (manually muted)
   */
  isAcknowledged(serviceId) {
    return this.state.acknowledged.has(serviceId);
  }

  /**
   * Get current failure info for a service
   */
  getFailure(serviceId) {
    return this.state.failures.get(serviceId);
  }

  /**
   * Get all current failures
   */
  getAllFailures() {
    return Array.from(this.state.failures.entries()).map(([id, info]) => ({
      serviceId: id,
      ...info,
    }));
  }
}
```

**Acceptance criteria:**
- Tracks failures with timestamps
- Implements cooldown logic
- Detects flapping (3+ changes in 10 min)
- Persists state to disk
- Loads state on startup

### Task 5.2-5.6: Continue with remaining monitoring components...

(Due to length constraints, I'll summarize the remaining tasks. Each would have similar detailed implementation.)

**Task 5.2: Implement Alert Cooldown Logic** - Already in StateManager above

**Task 5.3: Implement Flapping Detection** - Already in StateManager above

**Task 5.4: Add State Persistence** - Already in StateManager above

**Task 5.5: Create monitoring/AnomalyDetector.js**
- Uses CircularBuffer to track response times
- Calculates median of recent samples
- Alerts when current > 3x median
- Returns anomaly severity (warning/critical)

**Task 5.6: Create monitoring/Monitor.js Orchestrator**
- Coordinates all checkers
- Runs checks on cron schedules
- Updates StateManager
- Triggers notifications
- Main monitoring loop

---

## Phase 6: Telegram Notifications

### Task 6.1: Create notifications/MessageFormatter.js

**What to do:**
Create templates for all alert types:

```javascript
// src/notifications/MessageFormatter.js

export default class MessageFormatter {
  /**
   * Format service down alert
   */
  formatServiceDown(service, failure) {
    const downtime = this.formatDuration(Date.now() - failure.firstSeen);

    return `🔴 SERVICE DOWN

Service: ${service.name}
Type: ${service.type}
Since: ${new Date(failure.firstSeen).toLocaleString()} (${downtime} ago)
Error: ${failure.error}

Consecutive failures: ${failure.consecutiveFailures}`;
  }

  /**
   * Format service recovered alert
   */
  formatServiceRecovered(service, recovery) {
    const downtime = this.formatDuration(recovery.downtimeDuration);

    return `🟢 SERVICE RECOVERED

Service: ${service.name}
Type: ${service.type}
Downtime: ${downtime}
Failures seen: ${recovery.failuresSeen}`;
  }

  /**
   * Format anomaly alert
   */
  formatAnomaly(service, responseTime, median) {
    return `⚠️ PERFORMANCE DEGRADATION

Service: ${service.name}
Current response time: ${responseTime}ms
Normal response time: ${Math.round(median)}ms
Slowdown: ${(responseTime / median).toFixed(1)}x slower`;
  }

  /**
   * Format resource warning
   */
  formatResourceWarning(resource, current, threshold) {
    return `⚠️ RESOURCE WARNING

${resource.toUpperCase()} usage: ${current}%
Threshold: ${threshold}%`;
  }

  /**
   * Format SSL expiry warning
   */
  formatSSLWarning(domain, daysRemaining) {
    const emoji = daysRemaining < 7 ? '🔴' : '⚠️';

    return `${emoji} SSL CERTIFICATE EXPIRING

Domain: ${domain}
Days remaining: ${daysRemaining}
Action required: Renew certificate`;
  }

  /**
   * Format flapping alert
   */
  formatFlapping(service, transitionCount) {
    return `⚡ SERVICE FLAPPING

Service: ${service.name}
Type: ${service.type}
State changes: ${transitionCount} in last 10 minutes

This service is unstable. Further alerts suppressed for 30 minutes.`;
  }

  /**
   * Format duration in human-readable form
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
```

**Acceptance criteria:**
- Templates for all alert types
- Emoji indicators for severity
- Human-readable durations
- Clean, scannable format

### Tasks 6.2-6.4: Telegram Integration

**Task 6.2: Create notifications/TelegramNotifier.js**
- Initialize bot with token
- Send formatted messages
- Rate limiting (max 30 msgs/second)
- Retry logic for failed sends

**Task 6.3: Implement Rate Limiting**
- Queue messages if sending too fast
- Respect Telegram API limits
- Log rate limit warnings

**Task 6.4: Add Rich Formatting**
- Use Telegram markdown
- Add log excerpts for Docker/PM2 failures
- Include quick action buttons (future enhancement)

---

## Phase 7: Web Dashboard UI

### Task 7.1: Create ui/DashboardServer.js

**What to do:**
Build lightweight HTTP server:

```javascript
// src/ui/DashboardServer.js
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class DashboardServer {
  constructor(config, stateManager) {
    this.config = config;
    this.stateManager = stateManager;
    this.server = null;
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
   * Handle incoming requests
   */
  handleRequest(req, res) {
    const { url } = req;

    if (url === '/' || url === '/index.html') {
      this.serveFile(res, 'public/index.html', 'text/html');
    } else if (url === '/api/status') {
      this.serveStatus(res);
    } else if (url === '/health') {
      this.serveHealth(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  /**
   * Serve static file
   */
  serveFile(res, filePath, contentType) {
    const fullPath = path.join(__dirname, filePath);
    fs.readFile(fullPath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  }

  /**
   * Serve status API endpoint
   */
  serveStatus(res) {
    const status = this.buildStatusResponse();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  /**
   * Serve health check endpoint (for external monitoring)
   */
  serveHealth(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  /**
   * Build status response from current state
   */
  buildStatusResponse() {
    // This will be populated with actual service status
    return {
      timestamp: new Date().toISOString(),
      services: this.getServicesStatus(),
      alerts: this.stateManager.getAllFailures(),
      resources: this.getResourcesStatus(),
      ssl: this.getSSLStatus(),
    };
  }

  // These methods will be implemented with actual data
  getServicesStatus() { return []; }
  getResourcesStatus() { return {}; }
  getSSLStatus() { return []; }

  /**
   * Stop the server
   */
  stop() {
    if (this.server) {
      this.server.close();
      logger.info('Dashboard server stopped');
    }
  }
}
```

**Acceptance criteria:**
- HTTP server on configurable port
- Serves static HTML
- Provides /api/status endpoint
- Provides /health endpoint
- Proper error handling

### Tasks 7.2-7.9: Dashboard UI Development

**Task 7.2: Create /api/status Endpoint** - Implemented above

**Task 7.3: Create /health Endpoint** - Implemented above

**Task 7.4: Create ui/public/index.html**
- Single-page HTML with embedded CSS
- Responsive grid layout
- Auto-refresh via JavaScript
- Color-coded status cards

**Task 7.5-7.8: Add Dashboard Sections**
- Service overview grid (green/yellow/red cards)
- Current alerts list
- System resources (disk/RAM/CPU bars)
- SSL certificates table

**Task 7.9: Add Auto-refresh**
- Poll /api/status every 5 seconds
- Update UI without page reload
- Show "last updated" timestamp

---

## Phase 8: Main Application

### Task 8.1: Create src/index.js Entry Point

**What to do:**
Wire all components together:

```javascript
// src/index.js
import ConfigLoader from './config/ConfigLoader.js';
import ServiceDiscovery from './discovery/ServiceDiscovery.js';
import DiscoveredServicesWriter from './discovery/DiscoveredServicesWriter.js';
import Monitor from './monitoring/Monitor.js';
import StateManager from './monitoring/StateManager.js';
import TelegramNotifier from './notifications/TelegramNotifier.js';
import DashboardServer from './ui/DashboardServer.js';
import logger from './utils/logger.js';

class Watchdog {
  constructor() {
    this.config = null;
    this.stateManager = null;
    this.monitor = null;
    this.dashboard = null;
  }

  async start() {
    logger.info('🐕 Watchdog starting...');

    // Load configuration
    const configLoader = new ConfigLoader();
    this.config = configLoader.load();

    // Initialize state manager
    this.stateManager = new StateManager();
    this.stateManager.config = this.config;

    // Auto-save state every 60 seconds
    setInterval(() => this.stateManager.save(), 60000);

    // Initialize notifier
    const notifier = new TelegramNotifier(this.config);

    // Initialize discovery
    const discovery = new ServiceDiscovery();
    const writer = new DiscoveredServicesWriter();

    // Run initial discovery
    const discovered = await discovery.discover();
    writer.write(discovered);

    // Reload config with discovered services
    this.config = configLoader.load();

    // Initialize monitor
    this.monitor = new Monitor(this.config, this.stateManager, notifier);
    await this.monitor.start();

    // Start dashboard
    if (this.config.dashboard?.enabled) {
      this.dashboard = new DashboardServer(this.config, this.stateManager);
      this.dashboard.start();
    }

    // Send startup notification
    await notifier.sendMessage('🐕 Watchdog started and monitoring services');

    logger.info('Watchdog running', {
      services: this.config.services.docker.length + this.config.services.pm2.length,
    });
  }

  async shutdown() {
    logger.info('Shutting down gracefully...');

    if (this.monitor) {
      this.monitor.stop();
    }

    if (this.dashboard) {
      this.dashboard.stop();
    }

    if (this.stateManager) {
      this.stateManager.save();
    }

    logger.info('Shutdown complete');
    process.exit(0);
  }
}

// Start application
const watchdog = new Watchdog();

// Graceful shutdown handlers
process.on('SIGINT', () => watchdog.shutdown());
process.on('SIGTERM', () => watchdog.shutdown());

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start
watchdog.start().catch((error) => {
  logger.error('Failed to start', { error: error.message });
  process.exit(1);
});
```

**Acceptance criteria:**
- Loads config
- Runs discovery
- Starts monitoring
- Starts dashboard
- Graceful shutdown on SIGINT/SIGTERM
- Error handling for startup failures

### Tasks 8.2-8.5: Application Integration

**Task 8.2: Wire Components** - Implemented above

**Task 8.3: Set Up Cron Schedules**
- Service checks: every 60s
- Endpoint checks: every 5min
- Resource checks: every 5min
- SSL checks: every 24h
- Discovery: every 5min

**Task 8.4: Add Startup Notification**
- Send Telegram message on successful start
- Include services count
- Include dashboard URL

**Task 8.5: Create ecosystem.config.js**
```javascript
module.exports = {
  apps: [{
    name: 'watchdog',
    script: 'src/index.js',
    node_args: '--experimental-modules',
    env: {
      NODE_ENV: 'production',
    },
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
  }],
};
```

---

## Phase 9: Testing

### Task 9.1: Set Up Test Framework

**What to do:**
```json
// Update package.json
{
  "scripts": {
    "test": "node --test tests/**/*.test.js",
    "test:watch": "node --test --watch tests/**/*.test.js",
    "test:coverage": "node --test --experimental-test-coverage tests/**/*.test.js"
  }
}
```

Use Node.js built-in test runner (no external dependencies).

**Acceptance criteria:**
- `npm test` runs all tests
- Tests are in `tests/` directory
- Uses Node.js test runner

### Tasks 9.2-9.7: Write Tests

**Task 9.2: Unit Tests for Utils**
- Test CircularBuffer (push, getMedian, getAll)
- Test logger (different levels, no sensitive data)
- Test safeExec (command validation, injection prevention)

**Task 9.3: Unit Tests for Checkers**
- Mock command execution
- Test each checker with success/failure scenarios
- Verify response format

**Task 9.4: Unit Tests for State Management**
- Test failure tracking
- Test cooldown logic
- Test flapping detection
- Test state persistence

**Task 9.5: Integration Tests for Discovery**
- Mock Docker/PM2/systemd commands
- Test service discovery flow
- Test YAML generation

**Task 9.6: Integration Tests for Monitoring**
- Test full check cycle
- Test alert triggering
- Test state updates

**Task 9.7: GitHub Actions CI**
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run lint
      - run: npm test
```

**Acceptance criteria:**
- >80% code coverage
- All tests pass in CI
- Tests run on every PR

---

## Phase 10: Documentation

### Task 10.1: Write docs/README.md

**What to do:**
Comprehensive README with:
- Project description
- Features list
- Quick start guide
- Installation instructions
- Configuration guide
- Screenshots/examples
- Troubleshooting
- Contributing link
- License

**Acceptance criteria:**
- New users can get started in <5 minutes
- All features documented
- Examples for common use cases

### Tasks 10.2-10.6: Additional Documentation

**Task 10.2: docs/CONFIGURATION.md**
- All .env options explained
- YAML config structure
- Override examples
- Best practices

**Task 10.3: docs/ARCHITECTURE.md**
- System design overview
- Component interactions
- Design decisions and rationale
- Extension points

**Task 10.4: docs/DEVELOPMENT.md**
- Setting up dev environment
- Running tests
- Code style guide
- How to add new checkers
- Debugging tips

**Task 10.5: Add JSDoc Comments**
- Every public method documented
- Type definitions for all parameters
- Usage examples in comments

**Task 10.6: Create Usage Examples**
- Basic setup example
- Docker-only monitoring
- Multi-server monitoring
- Custom health checks

---

## Phase 11: Open Source Preparation

### Task 11.1: Add LICENSE (MIT)

```
MIT License

Copyright (c) 2026 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy...
```

### Task 11.2: Create CONTRIBUTING.md

- How to report bugs
- How to suggest features
- Pull request process
- Code review expectations
- Coding standards

### Task 11.3: Create CODE_OF_CONDUCT.md

Use Contributor Covenant template.

### Task 11.4-11.6: GitHub Templates

**Task 11.4: Issue Templates**
- Bug report template
- Feature request template
- Question template

**Task 11.5: PR Template**
- Checklist (tests, docs, lint)
- Description format
- Related issues

**Task 11.6: Create CHANGELOG.md**
```markdown
# Changelog

## [1.0.0] - 2026-XX-XX

### Added
- Auto-discovery for Docker, PM2, systemd services
- Telegram notifications with smart alerting
- Response time anomaly detection
- SSL certificate monitoring
- Web dashboard
```

### Task 11.7: Add SECURITY.md

- Supported versions
- How to report vulnerabilities
- Security best practices

### Task 11.8: Final Review

- Code quality check
- Documentation review
- Test all features manually
- Performance check
- Security audit
- Ready for v1.0.0 release

---

## Implementation Order

1. **Start with Phase 1** - Get foundation solid
2. **Phase 2 & 3 together** - Config system needs discovery
3. **Phase 4** - Checkers can be developed in parallel
4. **Phase 5** - Monitoring requires checkers
5. **Phase 6** - Notifications can be done anytime
6. **Phase 7** - UI can be developed in parallel
7. **Phase 8** - Integration brings it all together
8. **Phase 9** - Write tests as you go (TDD preferred)
9. **Phase 10 & 11** - Documentation and open-source prep at the end

## Success Criteria

- ✅ Auto-discovers services without configuration
- ✅ Monitors Docker, PM2, systemd, HTTP, SSL, resources
- ✅ Sends Telegram alerts with smart logic (no spam)
- ✅ Detects flapping and anomalies
- ✅ Clean web dashboard
- ✅ >80% test coverage
- ✅ Comprehensive documentation
- ✅ Secure, no vulnerabilities
- ✅ Clean code, no smells
- ✅ Ready for open-source release

---

## Notes for Future Developers

### Key Design Decisions

1. **Why auto-discovery?** Makes onboarding effortless. Users install and it works.

2. **Why only 3 dependencies?** Reduces supply chain risk, faster installs, smaller attack surface.

3. **Why YAML for config?** Industry standard for ops tools, supports comments, human-friendly.

4. **Why vanilla JS for UI?** No build step, no framework lock-in, fast and simple.

5. **Why in-memory state with snapshots?** Fast reads, simple architecture, snapshot provides persistence.

### Common Gotchas

- **Command injection:** Always use `safeExec` wrapper, never string interpolation
- **Telegram rate limits:** Queue messages, don't send >30/second
- **Flapping detection:** Track in 10-minute window, mute for 30 minutes
- **State persistence:** Save every 60s AND on shutdown
- **Discovery timing:** Run every 5 minutes to catch new services

### Extension Points

Want to add a new checker? Implement `HealthChecker` interface.
Want to add Slack notifications? Implement notifier interface.
Want to add metrics storage? Extend `StateManager`.

### Performance Considerations

- Checks run in parallel within each interval
- Use timeouts on all external calls (5s default)
- Resource checks cached for 60s
- State saves async, doesn't block monitoring

---

**END OF IMPLEMENTATION PLAN**

This plan should guide the complete implementation from start to finish. Each task has clear acceptance criteria. Follow the phases in order for best results.
