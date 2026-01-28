# Configuration Guide

Complete guide to configuring Watchdog for your monitoring needs.

## Configuration Sources

Watchdog uses a layered configuration system that merges settings from multiple sources:

1. **Built-in Defaults** - Sensible defaults for all options
2. **Environment Variables** (`.env`) - Secrets and deployment-specific settings
3. **YAML Configuration** (`watchdog.config.yml`) - Service customization
4. **Auto-Discovery** (`discovered-services.yml`) - Automatically detected services

Later sources override earlier ones, allowing you to customize only what you need.

## Environment Variables

Create a `.env` file in the project root:

### Telegram (Required)

```env
# Get from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Get from @userinfobot on Telegram
TELEGRAM_CHAT_ID=123456789
```

**Telegram Bot Commands:**

Once configured, your bot supports the following interactive commands:

- `/status` - Get current status of all monitored services
  - Shows healthy/unhealthy service counts
  - Lists active alerts with downtime
  - Groups services by type

- `/restart <service>` - Restart a service remotely
  - Examples: `/restart docker:postgres`, `/restart pm2:api-server`

- `/help` - Show available commands

The bot will also send automatic notifications for:
- Service failures
- Service recoveries
- Performance anomalies
- SSL certificate expirations
- Resource threshold breaches
- Flapping detection

### Dashboard (Optional)

```env
# Enable/disable web dashboard
DASHBOARD_ENABLED=true

# Port for dashboard HTTP server
DASHBOARD_PORT=3100

# HTTP Basic Authentication (leave empty to disable)
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your-secure-password-here

# API Key for restart functionality (leave empty to disable)
# Generate a secure key: openssl rand -hex 32
RESTART_API_KEY=your-secure-api-key-here
```

**Security Notes:**
- `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` enable HTTP Basic Auth for all dashboard endpoints
- `RESTART_API_KEY` adds additional authentication for the restart API endpoint
- If not set, dashboard will be accessible without authentication (not recommended for production)
- Restart functionality can also be used via Telegram bot commands

### Check Intervals (Optional)

All intervals are in milliseconds:

```env
# How often to check Docker/PM2/systemd services
CHECK_INTERVAL_SERVICES=60000           # Default: 1 minute

# How often to check HTTP endpoints
CHECK_INTERVAL_ENDPOINTS=30000          # Default: 30 seconds

# How often to check system resources (disk/RAM/CPU)
CHECK_INTERVAL_RESOURCES=300000         # Default: 5 minutes

# How often to check SSL certificates
CHECK_INTERVAL_SSL=86400000             # Default: 24 hours

# How often to re-run service discovery
DISCOVERY_INTERVAL=300000               # Default: 5 minutes
```

### Alert Settings (Optional)

```env
# Minutes to wait between re-alerts for same service
ALERT_COOLDOWN_MINUTES=30               # Default: 30 minutes

# State changes needed in window to trigger flapping detection
FLAPPING_THRESHOLD=3                    # Default: 3 transitions

# Time window for flapping detection (minutes)
FLAPPING_WINDOW_MINUTES=10              # Default: 10 minutes

# Send notification when service recovers
RECOVERY_NOTIFY=true                    # Default: true
```

### Anomaly Detection (Optional)

```env
# Enable performance anomaly detection
ANOMALY_DETECTION_ENABLED=true          # Default: true

# Response time samples to collect before detecting
ANOMALY_SAMPLES_REQUIRED=10             # Default: 10

# Multiplier for anomaly threshold (response > median * multiplier)
ANOMALY_MULTIPLIER=3.0                  # Default: 3.0
```

### Resource Thresholds (Optional)

```env
# Disk usage percentage to trigger alert
RESOURCE_DISK_THRESHOLD=85              # Default: 85%

# RAM usage percentage to trigger alert
RESOURCE_RAM_THRESHOLD=90               # Default: 90%

# CPU usage percentage to trigger alert
RESOURCE_CPU_THRESHOLD=90               # Default: 90%
```

## YAML Configuration

Create `watchdog.config.yml` for advanced customization:

### Full Example

```yaml
# HTTP endpoints to monitor
services:
  endpoints:
    - url: https://api.example.com/health
      name: Production API
      method: GET
      expectedStatus: 200
      timeout: 5000
      headers:
        Authorization: Bearer token123

    - url: https://example.com
      name: Main Website
      expectedStatus: 200

    - https://cdn.example.com/status  # Shorthand syntax

  # Override auto-discovered Docker containers
  docker:
    - name: postgres
      customName: Production Database

    - name: redis
      customName: Cache Server
      ignoreHealthCheck: true  # Don't check Docker health

  # Override auto-discovered PM2 processes
  pm2:
    - name: api-server
      customName: Node.js API

  # Override auto-discovered systemd services
  systemd:
    - name: nginx.service
      customName: Web Server

    - name: postgresql.service
      customName: Database Server

# Adjust resource thresholds
resources:
  disk:
    threshold: 85        # Alert at 85% disk usage
    path: /              # Path to check (default: /)

  ram:
    threshold: 90        # Alert at 90% RAM usage

  cpu:
    threshold: 90        # Alert at 90% CPU usage
    avgMinutes: 5        # Average over 5 minutes

# Configure anomaly detection
anomalyDetection:
  enabled: true
  samplesRequired: 10    # Samples needed before detecting
  sampleSize: 20         # Max samples to store per service
  multiplier: 3.0        # Alert threshold (3x median)

# Alert configuration
alerts:
  cooldownMinutes: 30         # Wait 30 min before re-alerting
  flappingThreshold: 3        # 3 state changes = flapping
  flappingWindowMinutes: 10   # Within 10-minute window
  recoveryNotify: true        # Send recovery notifications

# Check intervals (milliseconds)
intervals:
  services: 60000        # 1 minute
  endpoints: 30000       # 30 seconds
  resources: 300000      # 5 minutes
  ssl: 86400000          # 24 hours
  discovery: 300000      # 5 minutes

# Dashboard configuration
dashboard:
  enabled: true
  port: 3100
```

## Service Configuration

### HTTP Endpoints

#### Basic Endpoint

```yaml
services:
  endpoints:
    - url: https://api.example.com
      name: API Server
```

#### Advanced Endpoint

```yaml
services:
  endpoints:
    - url: https://api.example.com/health
      name: Production API
      method: GET                    # HTTP method
      expectedStatus: 200            # Expected response code
      timeout: 5000                  # Timeout in ms
      validateSSL: true              # Verify SSL certificate
      followRedirects: true          # Follow HTTP redirects
      headers:
        Authorization: Bearer token
        User-Agent: Watchdog/1.0
```

#### Shorthand Syntax

For simple GET requests expecting 200:

```yaml
services:
  endpoints:
    - https://example.com
    - https://api.example.com
```

### Docker Containers

Auto-discovered containers can be customized:

```yaml
services:
  docker:
    - name: postgres              # Container name from Docker
      customName: Database        # Friendly name in alerts
      ignoreHealthCheck: false    # Use Docker HEALTHCHECK
```

### PM2 Processes

Auto-discovered processes can be customized:

```yaml
services:
  pm2:
    - name: api-server           # PM2 process name
      customName: API Backend    # Friendly name in alerts
      processId: 0               # PM2 process ID (optional)
```

### systemd Services

Auto-discovered services can be customized:

```yaml
services:
  systemd:
    - name: nginx.service        # systemd service name
      customName: Web Server     # Friendly name in alerts

    - name: docker.service
      customName: Docker Daemon
```

## Resource Monitoring

### Disk Usage

```yaml
resources:
  disk:
    threshold: 85                # Alert at 85% usage
    path: /                      # Mount point to check
```

Check specific mount points:

```yaml
resources:
  disk:
    threshold: 90
    path: /var/lib/docker        # Check Docker volume space
```

### RAM Usage

```yaml
resources:
  ram:
    threshold: 90                # Alert at 90% RAM usage
```

### CPU Usage

```yaml
resources:
  cpu:
    threshold: 90                # Alert at 90% CPU usage
    avgMinutes: 5                # Average over 5 minutes
```

## Anomaly Detection

Configure performance monitoring for HTTP endpoints:

```yaml
anomalyDetection:
  enabled: true                  # Enable/disable detection
  samplesRequired: 10            # Samples before alerting
  sampleSize: 20                 # Rolling window size
  multiplier: 3.0                # Threshold multiplier
```

### How It Works

1. **Collection**: Records response times for each endpoint
2. **Baseline**: Calculates median response time from samples
3. **Detection**: Alerts when `responseTime > median * multiplier`
4. **Example**: If median is 100ms and multiplier is 3.0, alert at 300ms+

### Tuning Tips

- **Higher multiplier**: Fewer false positives, may miss degradation
- **Lower multiplier**: More sensitive, may cause alert fatigue
- **More samples**: More stable baseline, slower to detect new patterns
- **Fewer samples**: Faster adaptation, less stable

Recommended starting values:
- **Stable services**: `multiplier: 3.0`, `samplesRequired: 20`
- **Variable services**: `multiplier: 5.0`, `samplesRequired: 10`

## Alert Configuration

### Cooldown Period

Prevents alert spam for ongoing failures:

```yaml
alerts:
  cooldownMinutes: 30            # Re-alert after 30 minutes
```

With 30-minute cooldown:
- **First failure**: Immediate alert
- **Still failing after 10 min**: No alert (within cooldown)
- **Still failing after 35 min**: Second alert sent

### Flapping Detection

Prevents alerts from unstable services:

```yaml
alerts:
  flappingThreshold: 3           # 3 state changes
  flappingWindowMinutes: 10      # In 10 minutes
```

Example flapping scenario:
1. Service goes DOWN (change 1)
2. Service comes UP after 2 min (change 2)
3. Service goes DOWN after 1 min (change 3)
4. **Flapping detected!** Further alerts suppressed

Clear flapping history after stable period (10 minutes).

### Recovery Notifications

```yaml
alerts:
  recoveryNotify: true           # Send recovery alerts
```

When `true`, you'll receive:
- "🟢 SERVICE RECOVERED" messages
- Downtime duration
- Failure count during downtime

## Check Intervals

Balance between responsiveness and system load:

```yaml
intervals:
  services: 60000         # Docker/PM2/systemd (1 min)
  endpoints: 30000        # HTTP endpoints (30 sec)
  resources: 300000       # Disk/RAM/CPU (5 min)
  ssl: 86400000           # SSL certs (24 hours)
  discovery: 300000       # Service discovery (5 min)
```

### Interval Guidelines

**Fast (10-30 seconds)**
- Critical APIs
- User-facing services
- Real-time systems

**Medium (1-5 minutes)**
- Internal services
- Background workers
- Database health

**Slow (5+ minutes)**
- System resources
- SSL certificates
- Service discovery

**Considerations:**
- Shorter intervals = faster detection, more load
- Longer intervals = less load, slower detection
- HTTP endpoints: respect rate limits
- External APIs: avoid triggering abuse detection

## Dashboard

Configure the web dashboard:

```yaml
dashboard:
  enabled: true              # Enable dashboard
  port: 3100                 # HTTP port
```

### Dashboard Features

- Real-time service status
- System resource meters
- Active alerts list
- SSL certificate tracking
- Auto-refresh every 5 seconds

### Accessing Remotely

To access dashboard from other machines:

1. **Firewall**: Open port 3100
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 3100/tcp
   ```

2. **Reverse Proxy** (recommended for production):
   ```nginx
   # Nginx example
   location /watchdog {
     proxy_pass http://localhost:3100;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection 'upgrade';
     proxy_set_header Host $host;
   }
   ```

3. **SSH Tunnel** (for temporary access):
   ```bash
   ssh -L 3100:localhost:3100 user@server
   ```

## Configuration Validation

Watchdog validates configuration on startup:

### Valid Configuration
```
✅ Configuration loaded successfully
```

### Invalid Configuration
```
❌ Configuration validation failed:
  - Invalid threshold: resources.disk.threshold must be between 0-100
  - Missing required field: services.endpoints[0].url
  - Invalid interval: intervals.services must be >= 5000ms
```

### Common Validation Errors

**Invalid Threshold**
```yaml
# ❌ Wrong
resources:
  disk:
    threshold: 150          # Must be 0-100

# ✅ Correct
resources:
  disk:
    threshold: 85
```

**Invalid Interval**
```yaml
# ❌ Wrong (too fast)
intervals:
  services: 1000            # Minimum 5 seconds

# ✅ Correct
intervals:
  services: 30000
```

**Missing Required Field**
```yaml
# ❌ Wrong
services:
  endpoints:
    - name: API             # Missing 'url'

# ✅ Correct
services:
  endpoints:
    - name: API
      url: https://api.example.com
```

## Environment-Specific Configuration

### Development

`.env.development`:
```env
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3100
CHECK_INTERVAL_SERVICES=30000        # More frequent checks
CHECK_INTERVAL_ENDPOINTS=10000
ALERT_COOLDOWN_MINUTES=5             # Shorter cooldown
```

### Production

`.env.production`:
```env
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3100
CHECK_INTERVAL_SERVICES=60000        # Standard intervals
CHECK_INTERVAL_ENDPOINTS=30000
ALERT_COOLDOWN_MINUTES=30            # Standard cooldown
RESOURCE_DISK_THRESHOLD=90           # Higher threshold
```

### Staging

`.env.staging`:
```env
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3100
CHECK_INTERVAL_SERVICES=120000       # Less frequent
RECOVERY_NOTIFY=false                # Reduce alert volume
```

## Auto-Discovery

Watchdog automatically generates `discovered-services.yml`:

```yaml
# Auto-generated by Watchdog
# Last scan: 2026-01-28T15:00:00.000Z
# Total services: 5

discovered:
  docker:
    - name: postgres
      ports:
        - "5432:5432"
      hasHealthCheck: true
      image: postgres:15

  pm2:
    - name: api-server
      status: online
      port: 3000
      restarts: 0

  systemd:
    - nginx
    - docker
```

This file is informational only. To customize monitoring, use `watchdog.config.yml`.

## Best Practices

### 1. Start with Defaults

Begin with auto-discovery and adjust only what's needed:

```yaml
# Start simple
services:
  endpoints:
    - https://api.example.com
```

### 2. Use Descriptive Names

Help yourself during 3am alerts:

```yaml
services:
  docker:
    - name: postgres
      customName: Production Database (DO NOT RESTART)
```

### 3. Group Related Services

Organize configuration by function:

```yaml
services:
  endpoints:
    # Frontend
    - https://example.com
    - https://cdn.example.com

    # Backend
    - https://api.example.com
    - https://api.example.com/health
```

### 4. Document Custom Thresholds

Explain why you set specific values:

```yaml
resources:
  disk:
    threshold: 95         # High threshold OK - temp files cleared daily
  ram:
    threshold: 85         # Lower threshold - memory leak issues in past
```

### 5. Test Configuration Changes

After modifying config, restart and verify:

```bash
npm run pm2:restart
npm run pm2:logs         # Check for errors
```

## Troubleshooting

### Configuration Not Loading

1. Check file location: `watchdog.config.yml` in project root
2. Validate YAML syntax: https://www.yamllint.com/
3. Check logs for validation errors

### Endpoint Not Monitored

```yaml
# ❌ Wrong location
endpoints:
  - url: https://example.com

# ✅ Correct location
services:
  endpoints:
    - url: https://example.com
```

### Intervals Not Working

Intervals must be at least 5 seconds (5000ms):

```yaml
# ❌ Too fast
intervals:
  services: 1000

# ✅ Minimum
intervals:
  services: 5000
```

### Anomaly Detection Not Working

Ensure:
1. `anomalyDetection.enabled: true`
2. Enough samples collected (`samplesRequired`)
3. Response time actually exceeds threshold

Check anomaly detector stats in dashboard.

## Need Help?

- **Examples**: See `watchdog.config.example.yml`
- **Validation**: Watchdog validates on startup
- **Logs**: Check `logs/watchdog-out.log`
- **Issues**: [GitHub Issues](https://github.com/yourusername/watchdog/issues)
