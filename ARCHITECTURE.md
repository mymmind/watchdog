# Architecture Overview

Technical documentation for Watchdog's internal design and component structure.

## Table of Contents

- [System Architecture](#system-architecture)
- [Component Overview](#component-overview)
- [Data Flow](#data-flow)
- [Key Design Decisions](#key-design-decisions)
- [Security Considerations](#security-considerations)
- [Performance Characteristics](#performance-characteristics)

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Watchdog                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌─────────────────┐                │
│  │   Config     │──────│  State Manager  │                │
│  │   Loader     │      │  (Persistence)  │                │
│  └──────────────┘      └─────────────────┘                │
│         │                                                    │
│         │                                                    │
│  ┌──────▼─────────────────────────────────────┐           │
│  │            Discovery System                 │           │
│  ├─────────────────────────────────────────────┤           │
│  │  Docker  │  PM2  │  systemd  │  Writer    │           │
│  └──────────────────────────────────────────────┘           │
│         │                                                    │
│         │                                                    │
│  ┌──────▼─────────────────────────────────────┐           │
│  │          Monitor (Orchestrator)            │           │
│  ├─────────────────────────────────────────────┤           │
│  │  • Schedules checks (cron)                 │           │
│  │  • Coordinates checkers                    │           │
│  │  • Manages state transitions               │           │
│  │  • Triggers notifications                  │           │
│  └──────┬───────────────────┬──────────────────┘           │
│         │                   │                               │
│  ┌──────▼────────┐   ┌──────▼──────────────┐              │
│  │   Checkers    │   │  Anomaly Detector   │              │
│  ├───────────────┤   │  (Performance)      │              │
│  │ • Docker      │   └─────────────────────┘              │
│  │ • PM2         │                                          │
│  │ • systemd     │                                          │
│  │ • HTTP        │   ┌─────────────────────┐              │
│  │ • Resources   │   │  Message Formatter  │              │
│  │ • SSL         │   │  (Telegram)         │              │
│  └───────────────┘   └──────────┬──────────┘              │
│                                  │                          │
│                         ┌────────▼──────────┐              │
│                         │ Telegram Notifier │              │
│                         │ (Rate Limited)    │              │
│                         └───────────────────┘              │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │        Dashboard Server (HTTP)           │              │
│  ├──────────────────────────────────────────┤              │
│  │  GET /api/status  │  GET /health         │              │
│  │  Static HTML/CSS/JS                       │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘

External Interfaces:
 • Telegram API (outgoing notifications)
 • Docker socket (service discovery & health checks)
 • PM2 IPC (process status)
 • systemd D-Bus (service status)
 • HTTP/HTTPS endpoints (monitoring targets)
```

## Component Overview

### Core Components

#### 1. ConfigLoader (`src/config/ConfigLoader.js`)

**Purpose**: Merges configuration from multiple sources

**Responsibilities**:
- Load environment variables from `.env`
- Parse YAML configuration files
- Merge auto-discovered services
- Validate configuration against schema
- Provide unified config object

**Configuration Hierarchy** (later overrides earlier):
1. Built-in defaults (`src/config/defaults.js`)
2. Environment variables
3. User YAML config (`watchdog.config.yml`)
4. Discovered services (`discovered-services.yml`)

**Key Methods**:
- `load()`: Main entry point, returns merged config
- `deepMerge()`: Recursively merges objects
- `validate()`: Ensures configuration is valid

#### 2. StateManager (`src/monitoring/StateManager.js`)

**Purpose**: Persistent state management with automatic saving

**State Tracked**:
- Service failures (error, timestamp, consecutive count)
- Acknowledged services (muted alerts)
- State change history (for flapping detection)

**Responsibilities**:
- Record and retrieve service failures
- Implement alert cooldown logic
- Detect flapping services (3+ changes in 10 minutes)
- Persist state to disk (auto-save every 30 seconds)
- Calculate recovery metrics (downtime duration)

**Key Methods**:
- `recordFailure(serviceId, error)`: Returns action: `first_failure`, `ongoing_failure`, or `suppressed`
- `recordRecovery(serviceId)`: Clears failure, returns recovery info
- `isFlapping(serviceId)`: Checks if service is unstable
- `save()` / `load()`: Persistence operations

**State File Format** (`state.json`):
```json
{
  "failures": {
    "docker:postgres": {
      "error": "Container stopped",
      "firstSeen": 1706450000000,
      "lastSeen": 1706450300000,
      "lastAlertSent": 1706450000000,
      "consecutiveFailures": 5
    }
  },
  "acknowledged": ["systemd:nginx"],
  "stateChanges": {
    "pm2:api-server": [
      {"timestamp": 1706450000000, "state": "unhealthy"},
      {"timestamp": 1706450120000, "state": "healthy"}
    ]
  }
}
```

#### 3. Monitor (`src/monitoring/Monitor.js`)

**Purpose**: Central orchestrator for all health checking

**Responsibilities**:
- Schedule periodic checks using cron expressions
- Coordinate all checker modules
- Manage state transitions (healthy ↔ unhealthy)
- Detect flapping and anomalies
- Trigger appropriate notifications
- Provide statistics API

**Check Scheduling**:
```javascript
// Converts milliseconds to cron expressions
60000ms  →  "*/1 * * * *"    (every 1 minute)
30000ms  →  "*/30 * * * * *" (every 30 seconds)
```

**Workflow**:
1. Cron job triggers `checkServices()` or `checkEndpoints()`
2. Each service/endpoint checked via appropriate checker
3. Result passed to `handleCheckResult()`
4. State Manager updates state
5. If failure/recovery detected, notify via Telegram
6. If anomaly detected, send performance alert

**Key Methods**:
- `start()`: Initialize cron jobs and run initial checks
- `checkServices()`: Check Docker, PM2, systemd
- `checkEndpoints()`: Check HTTP endpoints + anomaly detection
- `checkResources()`: Check disk, RAM, CPU
- `checkSSL()`: Check SSL certificate expiration
- `handleFailure()` / `handleRecovery()`: State transition logic

#### 4. AnomalyDetector (`src/monitoring/AnomalyDetector.js`)

**Purpose**: Statistical performance monitoring

**Algorithm**:
1. Maintain circular buffer of last N response times per service
2. Calculate median baseline from historical samples
3. Compare current response time to `median * multiplier`
4. Alert if current exceeds threshold

**Configuration**:
- `sampleSize`: How many response times to track (default: 20)
- `samplesRequired`: Minimum samples before detecting (default: 10)
- `multiplier`: Threshold multiplier (default: 3.0)

**Example**:
```
Service: https://api.example.com
Historical response times: [100, 105, 98, 102, 95, ...]
Median: 100ms
Threshold: 100ms * 3.0 = 300ms

Current response: 450ms
→ ANOMALY DETECTED (450ms > 300ms)
```

**Data Structure**:
- `Map<serviceId, CircularBuffer>`: One buffer per monitored endpoint
- Persists via `toJSON()` / `fromJSON()`

#### 5. Health Checkers (`src/checkers/`)

**Base Class**: `HealthChecker`

All checkers implement:
```javascript
async check(service) {
  return {
    healthy: true|false,
    error: null|string,
    responseTime: number,      // Optional
    metadata: {...}            // Optional
  };
}
```

**DockerChecker**:
- Runs `docker inspect <container>`
- Checks `State.Running` and `State.Health.Status`
- Returns unhealthy if stopped or failing health check

**PM2Checker**:
- Runs `pm2 jlist` (JSON output)
- Finds process by name or ID
- Checks `pm_id` and `status` field
- Returns unhealthy if `status !== 'online'`

**SystemdChecker**:
- Runs `systemctl is-active <service>`
- Returns healthy if output is "active"
- Returns unhealthy otherwise

**HTTPChecker**:
- Makes HTTP/HTTPS request with `fetch`
- Measures response time
- Validates status code (default: 200)
- Validates SSL certificate if HTTPS
- Returns unhealthy if request fails or wrong status

**ResourceChecker**:
- **Disk**: Runs `df -h` and parses usage percentage
- **RAM**: Reads `/proc/meminfo` (Linux) or `vm_stat` (macOS)
- **CPU**: Reads `/proc/loadavg` (Linux) or `sysctl` (macOS)
- Returns unhealthy if usage > threshold

**SSLChecker**:
- Connects to HTTPS endpoint
- Extracts certificate expiration date
- Calculates days remaining
- Returns unhealthy if < 14 days

### Discovery System

#### 6. ServiceDiscovery (`src/discovery/ServiceDiscovery.js`)

**Purpose**: Auto-detect services running on the system

**Workflow**:
1. Run all discoverers in parallel for speed
2. Aggregate results with metadata
3. Return structured object with timestamp

**Discoverers**:

**DockerDiscovery**:
- Runs `docker ps --format json`
- Parses container info (name, ID, ports, image)
- Checks for HEALTHCHECK in container config
- Returns array of Docker services

**PM2Discovery**:
- Runs `pm2 jlist`
- Parses process info (name, ID, status, uptime)
- Detects listen ports from environment
- Returns array of PM2 processes

**SystemdDiscovery**:
- Runs `systemctl list-units --type=service --state=running`
- Filters common system services (e.g., user@, session-*)
- Returns array of active services

**Output Structure**:
```javascript
{
  timestamp: '2026-01-28T15:00:00.000Z',
  scanDuration: 150,
  docker: [{name, ports, hasHealthCheck, image}],
  pm2: [{name, status, port, restarts}],
  systemd: [{name, serviceName}],
  summary: {totalServices: 10, docker: 3, pm2: 2, systemd: 5}
}
```

#### 7. DiscoveredServicesWriter (`src/discovery/DiscoveredServicesWriter.js`)

**Purpose**: Generate YAML file showing discovered services

**Output**: `discovered-services.yml`
```yaml
# Auto-generated by Watchdog
# Last scan: 2026-01-28T15:00:00.000Z
# Scan duration: 150ms
# Total services: 10

discovered:
  docker:
    - name: postgres
      ports: ['5432:5432']
      hasHealthCheck: true
      image: postgres:15
```

**Note**: This file is informational only. Not loaded by ConfigLoader.

### Notification System

#### 8. TelegramNotifier (`src/notifications/TelegramNotifier.js`)

**Purpose**: Send formatted alerts via Telegram Bot API

**Features**:
- Rate-limited message queue (30 msgs/sec max)
- Retry logic for failed sends
- Connection testing on startup
- Graceful degradation if Telegram unavailable

**Message Queue**:
```javascript
class TelegramNotifier {
  messageQueue = [];
  lastSentTime = 0;
  minInterval = 33ms;  // ~30 msgs/sec

  async send(message) {
    this.messageQueue.push(message);
    this.processQueue();  // Non-blocking
  }

  async processQueue() {
    while (queue.length > 0) {
      await throttle(minInterval);
      await bot.sendMessage(chatId, message);
    }
  }
}
```

**Notification Types**:
- Service down (first failure)
- Service still down (ongoing failure)
- Service recovered
- Performance anomaly
- Flapping detected
- Resource warning (disk/RAM/CPU)
- SSL certificate expiring
- Startup/shutdown

#### 9. MessageFormatter (`src/notifications/MessageFormatter.js`)

**Purpose**: Format rich Telegram messages

**Example Output**:
```
🔴 SERVICE DOWN

Service: postgres (Docker)
Error: Container stopped
Time: 2026-01-28 15:30:45

This is the first failure. Monitoring...
```

**Features**:
- Emoji indicators (🔴🟢⚠️🔐⚡)
- Structured formatting
- Duration formatting (2h 30m, 5m 45s)
- Metadata display

### Dashboard

#### 10. DashboardServer (`src/ui/DashboardServer.js`)

**Purpose**: HTTP server providing real-time status view

**Endpoints**:

**GET /api/status**:
```json
{
  "timestamp": "2026-01-28T15:00:00.000Z",
  "services": [
    {
      "name": "postgres",
      "type": "docker",
      "healthy": true,
      "responseTime": null
    }
  ],
  "alerts": [
    {
      "serviceId": "pm2:api-server",
      "error": "Process offline",
      "duration": 120000,
      "consecutiveFailures": 3
    }
  ],
  "resources": {
    "disk": {"usage": 75, "threshold": 85},
    "ram": {"usage": 82, "threshold": 90},
    "cpu": {"usage": 45, "threshold": 90}
  },
  "ssl": [
    {
      "url": "https://example.com",
      "daysRemaining": 45
    }
  ],
  "stats": {
    "totalServices": 10,
    "healthy": 9,
    "unhealthy": 1,
    "activeAlerts": 1
  }
}
```

**GET /health**:
```json
{
  "status": "ok",
  "uptime": 86400,
  "version": "1.0.0"
}
```

**GET /**:
Serves static `index.html` with embedded CSS/JS

**Update Mechanism**:
- Frontend polls `/api/status` every 5 seconds
- Dashboard server queries State Manager and Monitor
- No WebSockets (keeps it simple)

### Utility Components

#### 11. CircularBuffer (`src/utils/CircularBuffer.js`)

**Purpose**: Fixed-size FIFO buffer for response times

**Implementation**:
```javascript
class CircularBuffer {
  constructor(maxSize) {
    this.buffer = new Array(maxSize);
    this.head = 0;
    this.size = 0;
  }

  push(value) {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.buffer.length;
    if (this.size < this.buffer.length) this.size++;
  }

  getMedian() {
    const sorted = this.getAll().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}
```

**Methods**:
- `push()`: Add value (overwrites oldest)
- `getMedian()`: Calculate median
- `getAverage()`: Calculate mean
- `getMin()` / `getMax()`: Extremes
- `getAll()`: All values (for analysis)
- `toJSON()` / `fromJSON()`: Serialization

#### 12. Logger (`src/utils/logger.js`)

**Purpose**: Structured logging with colors

**Levels**: `DEBUG`, `INFO`, `WARN`, `ERROR`

**Features**:
- Color-coded output (green INFO, yellow WARN, red ERROR)
- JSON formatting for structured data
- Timestamp on every log
- Sensitive data sanitization (removes tokens, passwords)

**Output Example**:
```
[2026-01-28T15:00:00.000Z] [INFO] Service recovered {"serviceId":"docker:postgres","downtime":"2m 30s"}
```

#### 13. Command Executor (`src/utils/exec.js`)

**Purpose**: Safe command execution with injection prevention

**Security Features**:
- **Whitelist**: Only allows specific commands
- **Argument Sanitization**: Removes shell metacharacters
- **No Shell**: Uses `spawn` directly, not `sh -c`

**Allowed Commands**:
```javascript
const ALLOWED = [
  'docker', 'pm2', 'systemctl',
  'df', 'free', 'top',
  'redis-cli', 'pg_isready'
];
```

**Example**:
```javascript
// ✅ Safe
await safeExec('docker', ['inspect', 'postgres']);

// ❌ Blocked
await safeExec('rm', ['-rf', '/']);  // Command not in whitelist

// ❌ Sanitized
await safeExec('docker', ['ps; rm -rf /']);  // '; rm -rf /' removed
```

## Data Flow

### 1. Startup Sequence

```
1. Load configuration
   ├─> Read .env file
   ├─> Parse watchdog.config.yml
   ├─> Load discovered-services.yml
   └─> Validate & merge

2. Initialize state manager
   └─> Load state.json (if exists)

3. Initialize Telegram notifier
   ├─> Test bot connection
   └─> Start message queue

4. Run service discovery
   ├─> Scan Docker/PM2/systemd (parallel)
   ├─> Write discovered-services.yml
   └─> Reload configuration

5. Start dashboard (if enabled)
   └─> HTTP server on configured port

6. Initialize monitor
   ├─> Create all checkers
   ├─> Create anomaly detector
   └─> Schedule cron jobs

7. Run initial health checks
   ├─> Check services
   ├─> Check endpoints
   └─> Check resources

8. Send startup notification
   └─> Telegram message with stats

9. Enter monitoring loop
   └─> Cron jobs run checks at intervals
```

### 2. Health Check Flow

```
Cron triggers check
      │
      ▼
┌─────────────┐
│  Checker    │
│  executes   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Check result   │
│  {healthy, ...} │
└──────┬──────────┘
       │
       ▼
┌─────────────────────┐
│  Monitor receives   │
│  result             │
└──────┬──────────────┘
       │
       ├──> Healthy? ──Yes──> Previous failure? ──Yes──> handleRecovery()
       │                                          └─No──> (no action)
       │
       └──> Unhealthy? ─Yes──> recordStateChange()
                                     │
                                     ▼
                               isFlapping()?
                                     │
                                ├─Yes──> sendFlappingAlert()
                                │        suppressFutureAlerts()
                                │
                                └─No───> recordFailure()
                                              │
                                              ▼
                                         first_failure?
                                              │
                                         ├─Yes──> sendFailureAlert()
                                         │
                                         └─No───> ongoing_failure?
                                                       │
                                                  ├─Yes──> sendOngoingAlert()
                                                  │
                                                  └─No───> (suppressed by cooldown)
```

### 3. Anomaly Detection Flow

```
HTTP endpoint check
      │
      ▼
┌──────────────────┐
│  Measure         │
│  response time   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│  Record in circular  │
│  buffer              │
└────────┬─────────────┘
         │
         ▼
Enough samples? ──No──> (wait for more)
         │
        Yes
         │
         ▼
┌─────────────────────┐
│  Calculate median   │
│  from buffer        │
└────────┬────────────┘
         │
         ▼
┌───────────────────────┐
│  responseTime >       │
│  median * multiplier? │
└────────┬──────────────┘
         │
    ├─Yes──> sendAnomalyAlert()
    │
    └─No───> (normal performance)
```

### 4. Notification Flow

```
Event occurs
(failure/recovery/anomaly)
      │
      ▼
┌─────────────────┐
│  Format message │
│  via Formatter  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Add to queue   │
│  in Notifier    │
└──────┬──────────┘
       │
       ▼
┌──────────────────┐
│  Process queue   │
│  (rate limited)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Send via        │
│  Telegram API    │
└──────┬───────────┘
       │
       ├─Success──> (done)
       │
       └─Failure──> Retry with backoff
                         │
                         └─> Max retries reached
                                 │
                                 └─> Log error, drop message
```

## Key Design Decisions

### 1. Node.js Built-in Test Runner

**Decision**: Use `node:test` instead of Jest/Mocha

**Rationale**:
- Zero dependencies for testing
- Faster startup (no framework overhead)
- Native async/await support
- Built-in assertion library
- Parallel execution by default

**Trade-offs**:
- Less mature than Jest
- Fewer features (no snapshot testing)
- Smaller ecosystem

### 2. Auto-Discovery vs Manual Configuration

**Decision**: Auto-discover by default, allow YAML overrides

**Rationale**:
- Zero-config experience for users
- Services added/removed automatically
- YAML provides customization when needed

**Implementation**:
- Discovery runs on startup and periodically (5 min default)
- Generated YAML is informational only
- User YAML overrides discovered config

### 3. Circular Buffer for Response Times

**Decision**: Fixed-size FIFO buffer instead of unlimited history

**Rationale**:
- Bounded memory usage (20 samples = 160 bytes per service)
- Recent samples more relevant than old
- Simple median calculation
- Easy to serialize/deserialize

**Trade-offs**:
- Can't analyze long-term trends
- Sudden baseline changes take time to adapt

### 4. Median vs Average for Anomaly Detection

**Decision**: Use median instead of average

**Rationale**:
- Robust to outliers (one slow request doesn't skew baseline)
- More stable threshold
- Better for variable response times

**Example**:
```
Samples: [100, 100, 105, 98, 102, 5000]  // One outlier

Average: 742ms   (skewed by outlier)
Median: 101ms    (robust)

With average, 300ms wouldn't trigger alert
With median, 300ms correctly triggers alert
```

### 5. Flapping Detection

**Decision**: Track state changes, not failure count

**Rationale**:
- Service bouncing (up→down→up) is different from staying down
- Prevents alert spam from unstable services
- Simple threshold (3 changes in 10 min)

**Implementation**:
- Record each healthy↔unhealthy transition
- Count transitions in sliding 10-minute window
- If ≥3 transitions, mark as flapping
- Suppress all alerts until stable (10 min without changes)

### 6. Alert Cooldown

**Decision**: Per-service cooldown, not global

**Rationale**:
- One failing service shouldn't prevent alerts for others
- Balances alerting vs alert fatigue
- Configurable per deployment

**Implementation**:
```
First failure: Alert immediately
Still failing after 5 min: No alert (within 30min cooldown)
Still failing after 35 min: Alert again (cooldown expired)
```

### 7. Single Process Architecture

**Decision**: Single Node.js process instead of microservices

**Rationale**:
- Simpler deployment (one PM2 process)
- Lower resource usage
- No inter-process communication overhead
- Easier debugging

**Trade-offs**:
- Single point of failure
- Can't scale horizontally (but monitoring doesn't need to)
- All components share event loop

### 8. Cron-based Scheduling

**Decision**: Use cron instead of simple intervals

**Rationale**:
- More flexible (can schedule at specific times)
- Standard cron syntax
- Aligned intervals (checks at :00, :30 instead of drift)

**Trade-offs**:
- Slightly more complex than `setInterval`
- Need to convert milliseconds to cron expressions

### 9. Stateless Dashboard

**Decision**: REST API + client polling instead of WebSockets

**Rationale**:
- Simpler implementation
- No WebSocket connection management
- Works through reverse proxies
- Auto-reconnects if server restarts

**Trade-offs**:
- Higher bandwidth (polling every 5 sec)
- Slightly delayed updates

### 10. ES Modules

**Decision**: Use ES modules (`import/export`) instead of CommonJS

**Rationale**:
- Modern JavaScript standard
- Better static analysis
- Tree-shaking support
- Clearer module boundaries

**Requirements**:
- Node.js 20+ (LTS)
- `"type": "module"` in package.json
- `.js` extension in imports

## Security Considerations

### 1. Command Injection Prevention

**Threat**: Malicious input in service names could execute commands

**Mitigation**:
```javascript
// Whitelist allowed commands
const ALLOWED_COMMANDS = ['docker', 'pm2', 'systemctl'];

// Sanitize arguments
function sanitizeArg(arg) {
  return arg.replace(/[;&|`$()]/g, '');
}

// Use spawn, not exec (no shell)
spawn(command, args);  // ✅ Safe
exec(`${command} ${args}`);  // ❌ Dangerous
```

### 2. Sensitive Data Sanitization

**Threat**: Logs might contain tokens, passwords

**Mitigation**:
```javascript
function sanitize(obj) {
  const sensitive = ['token', 'password', 'secret', 'key'];
  // Recursively scrub sensitive keys
}
```

### 3. Telegram Token Protection

**Threat**: Exposed `.env` file leaks bot token

**Mitigation**:
- `.env` in `.gitignore`
- `.env.example` for template
- Validate token format on startup

### 4. Dashboard Security

**Threat**: Unauthenticated access to monitoring data

**Current State**: No authentication (local access assumed)

**Future Recommendations**:
- Add basic auth for remote access
- Use reverse proxy with OAuth
- Implement API keys for `/api/status`

### 5. File System Access

**Threat**: Path traversal in config files

**Mitigation**:
- Validate file paths
- Use absolute paths
- Restrict to project directory

## Performance Characteristics

### Resource Usage

**Memory**:
- Base: ~50MB (Node.js runtime)
- Per service: ~1KB (state tracking)
- Response time buffers: ~160 bytes per endpoint

**CPU**:
- Idle: <1% (waiting for cron)
- Check execution: 1-2% spike
- Mostly I/O bound (waiting for Docker/PM2/systemctl)

**Disk**:
- Config files: <1KB
- State file: <10KB (depends on service count)
- Logs: Grows over time (rotate recommended)

### Scalability

**Services**:
- Tested: 50 services
- Theoretical: 1000+ (limited by check duration)

**Endpoints**:
- Tested: 20 endpoints
- Theoretical: 100+ (limited by rate limits)

**Bottlenecks**:
1. Telegram API: 30 msgs/sec limit
2. Docker socket: Serial command execution
3. systemctl: Slow on systems with many services

### Optimization Strategies

**Parallel Execution**:
```javascript
// ✅ Good: Check services in parallel
await Promise.allSettled(
  services.map(s => checkService(s))
);

// ❌ Bad: Check services serially
for (const service of services) {
  await checkService(service);  // Slow!
}
```

**Caching**:
- Discovery results cached for 5 minutes
- Resource checks cached for duration of check interval
- State manager auto-saves at most once per 30 seconds

**Lazy Loading**:
- Dashboard only queries state when `/api/status` called
- Anomaly detector only creates buffers when services first checked

## Extension Points

### Adding New Checkers

1. Extend `HealthChecker` base class
2. Implement `async check(service)` method
3. Return standard result object
4. Register in `Monitor` constructor
5. Add discovery module (optional)

Example:
```javascript
class RedisChecker extends HealthChecker {
  async check(service) {
    try {
      const result = await safeExec('redis-cli', [
        '-h', service.host,
        'ping'
      ]);
      return this.createSuccessResult();
    } catch (error) {
      return this.createFailureResult(error.message);
    }
  }
}
```

### Adding New Notification Channels

1. Create notifier class (e.g., `SlackNotifier.js`)
2. Implement same interface as `TelegramNotifier`
3. Add to `Monitor` constructor
4. Configure in environment variables

### Adding New Metrics

1. Add data structure to `AnomalyDetector` or create new detector
2. Update `Monitor` to collect metrics
3. Add endpoint to `DashboardServer`
4. Update frontend to display

## Debugging

### Enable Debug Logging

```env
LOG_LEVEL=debug
```

### Inspect State File

```bash
cat state.json | jq .
```

### Test Telegram Connection

```javascript
const notifier = new TelegramNotifier(config);
await notifier.testConnection();
```

### Manually Trigger Check

```javascript
const monitor = new Monitor(config, stateManager, notifier);
await monitor.checkEndpoints();
```

## Future Architecture Improvements

1. **Plugin System**: Allow third-party checkers
2. **Multi-Server Support**: Monitor multiple servers from one instance
3. **Distributed State**: Redis/etcd for shared state
4. **Event Bus**: Decouple components with event emitter
5. **gRPC API**: For programmatic access
6. **Metrics Export**: Prometheus/StatsD integration

---

For implementation details, see source code in `src/`.
For configuration options, see [CONFIGURATION.md](CONFIGURATION.md).
For contributing guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md).
