# 🐕 Watchdog

**Intelligent, auto-discovering server monitoring with instant Telegram alerts**

Watchdog automatically detects and monitors Docker containers, PM2 processes, systemd services, and HTTP endpoints on your server without manual configuration. Get instant notifications when services fail, recover, or experience performance degradation.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-67%20passing-brightgreen)](tests/)

## ✨ Features

### 🔍 Auto-Discovery
- **Zero Configuration Required**: Automatically discovers Docker containers, PM2 processes, and systemd services
- **Dynamic Updates**: Periodic re-scanning detects new services without restart
- **Smart Detection**: Identifies ports, health checks, and service metadata

### 🚨 Intelligent Alerting
- **Telegram Notifications**: Instant alerts with rich formatting
- **Flapping Detection**: Prevents alert spam from unstable services
- **Alert Cooldown**: Configurable intervals between re-alerts (default: 30 minutes)
- **Recovery Notifications**: Get notified when services come back online

### 📊 Anomaly Detection
- **Performance Monitoring**: Tracks response times for HTTP endpoints
- **Statistical Analysis**: Detects when response times exceed 3x median
- **Adaptive Baseline**: Automatically learns normal performance patterns
- **Early Warning**: Catch degradation before complete failure

### 💾 State Management
- **Persistent State**: Survives restarts without losing history
- **Downtime Tracking**: Measures how long services were offline
- **Failure Counting**: Tracks consecutive failures for each service

### 🖥️ Web Dashboard
- **Real-Time Status**: Live view of all monitored services
- **System Resources**: Disk, RAM, and CPU usage at a glance
- **SSL Certificate Monitoring**: Track expiration dates
- **Responsive Design**: Works on desktop and mobile
- **Auto-Refresh**: Updates every 5 seconds

### 🔒 Security & Reliability
- **Command Injection Prevention**: Whitelist-based command execution
- **Sensitive Data Sanitization**: Automatic scrubbing of logs
- **Graceful Shutdown**: Saves state before exit
- **Error Recovery**: Continues monitoring even if individual checks fail

## 📋 Requirements

- **Node.js**: 20.0.0 or higher
- **Telegram Bot**: For notifications (see Setup section)
- **Optional**: Docker, PM2, systemd for service discovery

## 🚀 Quick Start

### 1. Install Dependencies

```bash
git clone https://github.com/mymmind/watchdog.git
cd watchdog
npm install
```

### 2. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create new bot with `/newbot` command
3. Save the bot token
4. Start a chat with your bot
5. Get your chat ID: message [@userinfobot](https://t.me/userinfobot)

### 3. Configure Environment

Create `.env` file:

```env
# Telegram Configuration (Required)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Dashboard (Optional)
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3100

# Intervals (Optional, in milliseconds)
CHECK_INTERVAL_SERVICES=60000      # Docker, PM2, systemd (1 minute)
CHECK_INTERVAL_ENDPOINTS=30000     # HTTP endpoints (30 seconds)
CHECK_INTERVAL_RESOURCES=300000    # Disk/RAM/CPU (5 minutes)
CHECK_INTERVAL_SSL=86400000        # SSL certificates (24 hours)
```

### 4. Start Watchdog

```bash
# Development
npm start

# Production with PM2
npm run pm2:start

# View logs
npm run pm2:logs
```

### 5. Access Dashboard

Open [http://localhost:3100](http://localhost:3100) in your browser.

## 📖 Documentation

- **[Configuration Guide](CONFIGURATION.md)** - Detailed configuration options
- **[Architecture Overview](ARCHITECTURE.md)** - System design and components
- **[Development Guide](DEVELOPMENT.md)** - Contributing and development setup
- **[Test Documentation](tests/README.md)** - Test suite and coverage

## 🎯 What Gets Monitored

### Automatically Discovered Services

**Docker Containers**
- Running status
- Health check results (if configured)
- Container restarts

**PM2 Processes**
- Process online/offline status
- Automatic restart detection
- Process uptime tracking

**systemd Services**
- Service active/inactive status
- Failed service detection
- Service restart monitoring

### Configured Endpoints

**HTTP/HTTPS Endpoints**
- Response status codes
- Response time tracking
- SSL certificate expiration (HTTPS only)
- Performance anomaly detection

**System Resources**
- Disk usage (configurable threshold)
- RAM usage (configurable threshold)
- CPU usage (configurable threshold)

## 🎨 Dashboard Preview

The web dashboard provides a clean, dark-themed interface showing:

- **Overall Status**: Green (all operational) or Red (issues detected)
- **Service Cards**: Visual status for each monitored service
- **Resource Meters**: Progress bars for disk, RAM, CPU
- **Active Alerts**: List of current failures with details
- **SSL Certificates**: Days remaining until expiration

## ⚙️ Advanced Configuration

### Custom Service Configuration

While Watchdog auto-discovers services, you can customize monitoring with `watchdog.config.yml`:

```yaml
services:
  # Add HTTP endpoints to monitor
  endpoints:
    - url: https://api.example.com/health
      name: Production API
      expectedStatus: 200

    - url: https://example.com
      name: Main Website

  # Override discovered services
  docker:
    - name: postgres
      customName: Production Database

# Adjust thresholds
resources:
  disk:
    threshold: 85  # Alert at 85% usage
  ram:
    threshold: 90
  cpu:
    threshold: 90

# Configure anomaly detection
anomalyDetection:
  enabled: true
  samplesRequired: 10
  multiplier: 3.0  # Alert when 3x median response time
```

See [CONFIGURATION.md](CONFIGURATION.md) for all options.

## 📱 Notification Examples

### Service Down
```
🔴 SERVICE DOWN

Service: api-server (PM2)
Error: Process offline
Time: 2026-01-28 15:30:45

This is the first failure. Monitoring...
```

### Service Recovered
```
🟢 SERVICE RECOVERED

Service: api-server (PM2)
Downtime: 2m 30s
Failures: 3

Service is back online!
```

### Performance Degradation
```
⚠️ PERFORMANCE DEGRADATION

Endpoint: https://api.example.com
Response Time: 3000ms (normally 150ms)
Deviation: 20x slower than usual

Check server load and database queries.
```

### SSL Certificate Expiring
```
🔐 SSL CERTIFICATE EXPIRING

Domain: https://example.com
Days Remaining: 10
Expires: 2026-02-07

Renew certificate soon!
```

## 🔧 Troubleshooting

### Telegram Not Receiving Notifications

1. Verify bot token and chat ID in `.env`
2. Ensure you've started a chat with the bot
3. Check logs: `npm run pm2:logs`

### Services Not Discovered

**Docker:**
```bash
# Verify Docker is accessible
docker ps

# Check Watchdog logs for errors
```

**PM2:**
```bash
# Verify PM2 is installed and accessible
pm2 list
```

**systemd:**
```bash
# Verify systemctl is available
systemctl --version
```

### Dashboard Not Accessible

1. Check `DASHBOARD_ENABLED=true` in `.env`
2. Verify port is not in use: `lsof -i :3100`
3. Check firewall rules if accessing remotely

## 🤝 Contributing

Contributions are welcome! Please see [DEVELOPMENT.md](DEVELOPMENT.md) for:

- Development setup
- Code structure
- Testing guidelines
- Pull request process

## 📜 License

[MIT License](LICENSE) - Feel free to use in personal and commercial projects.

## 🙏 Credits

Built with:
- [Node.js](https://nodejs.org/) - Runtime
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram integration
- [node-cron](https://github.com/node-cron/node-cron) - Scheduling
- [YAML](https://github.com/eemeli/yaml) - Configuration parsing

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/mymmind/watchdog/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mymmind/watchdog/discussions)
- **Documentation**: [Wiki](https://github.com/mymmind/watchdog/wiki)

## 🗺️ Roadmap

- [ ] Email notification support
- [ ] Slack webhook integration
- [ ] Custom alerting rules (threshold-based)
- [ ] Historical metrics and graphs
- [ ] Mobile app for iOS/Android
- [ ] Multi-server support (monitor multiple servers from one Watchdog instance)
- [ ] Integration with Prometheus/Grafana
- [ ] Custom health check scripts

---

**Made with ❤️ for DevOps engineers who value reliability**

If Watchdog helps you sleep better at night, consider giving it a ⭐️ on GitHub!
