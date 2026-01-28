# Changelog

All notable changes to Watchdog will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-28

### Added
- **Auto-Discovery System**: Automatically detects Docker containers, PM2 processes, and systemd services
- **Health Checking**: Comprehensive health checks for all discovered services
- **HTTP Endpoint Monitoring**: Monitor HTTP/HTTPS endpoints with response time tracking
- **Anomaly Detection**: Statistical analysis to detect performance degradation (3x median threshold)
- **Telegram Notifications**: Instant alerts with rich formatting via Telegram Bot API
- **Smart Alerting**:
  - Alert cooldown to prevent spam (30 minutes default)
  - Flapping detection for unstable services
  - Recovery notifications
- **State Management**: Persistent state tracking across restarts
- **Web Dashboard**: Real-time monitoring dashboard with auto-refresh
- **Resource Monitoring**: Track disk, RAM, and CPU usage with configurable thresholds
- **SSL Certificate Monitoring**: Track certificate expiration dates (14-day warning)
- **Flexible Configuration**: Environment variables + YAML configuration
- **Security Features**:
  - Command injection prevention with whitelisted commands
  - Sensitive data sanitization in logs
  - Input validation and error handling
- **Comprehensive Testing**: 67 tests (50 unit + 17 integration) with 100% pass rate
- **Documentation**:
  - Complete README with quick start guide
  - Configuration guide with all options
  - Architecture documentation
  - Development guide for contributors
  - Test documentation

### Technical Details
- **Node.js**: Requires 20.0.0 or higher
- **Dependencies**: Minimal (4 dependencies: telegram bot, cron, dotenv, yaml)
- **ES Modules**: Modern JavaScript with import/export
- **PM2 Support**: Ecosystem configuration for production deployment
- **Graceful Shutdown**: Saves state before exit on SIGINT/SIGTERM

### Performance
- Memory usage: ~50MB base + ~1KB per service
- CPU usage: <1% idle, 1-2% during checks
- Scales to 50+ services tested, theoretically 1000+

### Known Limitations
- Dashboard has no authentication (local access assumed)
- Single server monitoring only (multi-server planned for v2.0)
- Telegram-only notifications (Slack/Email planned)

[1.0.0]: https://github.com/yourusername/watchdog/releases/tag/v1.0.0
