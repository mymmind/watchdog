# Server Monitor Tech Spec

A lightweight monitoring service for the Hetzner server (mmm-tts-prod) that sends Telegram alerts when services go down.

## Overview

**Name:** Watchdog  
**Purpose:** Monitor all running services and notify via Telegram when something fails  
**Host:** 46.224.21.200 (existing Hetzner server)  
**Runtime:** Node.js with PM2 (consistent with existing stack)

## What to Monitor

Based on the current server map, the following services need monitoring:

### Docker Containers
| Container | Health Check Method |
|-----------|---------------------|
| ai-service | Docker health + HTTP ping to port 3001 |
| mmm-tts | Docker health + HTTP ping to port 8000 |
| polybet-web | Docker health + HTTP ping to port 8001 |
| polybet-grafana | Docker health |
| polybet-prometheus | Docker health |
| polybet-postgres | Docker health + pg_isready |
| polybet-redis | Docker health + redis-cli ping |

### PM2 Processes
| Process | Health Check Method |
|---------|---------------------|
| iossubmissionguide | PM2 status + HTTP ping to port 3000 |
| iosguide-api | PM2 status + HTTP ping to port 3005 |
| watchmyplace-api | PM2 status (currently errored) |

### System Services
| Service | Health Check Method |
|---------|---------------------|
| nginx | systemctl status + HTTP 200 on localhost |
| postgresql@16-main | systemctl status |
| redis-server | systemctl status + redis-cli ping |
| fail2ban | systemctl status |

### External Endpoints (SSL + Uptime)
| Domain | Expected Response |
|--------|-------------------|
| https://ai.mymaternalmind.com | 200 OK |
| https://tts.mymaternalmind.com | 200 OK |
| https://iossubmissionguide.com | 200 OK |
| https://sieggg.com | 200 OK |
| https://mirramoments.com | 200 OK |
| https://watchmyplace.app | 200 OK |

### System Resources
| Metric | Alert Threshold |
|--------|-----------------|
| Disk usage | > 85% |
| RAM usage | > 90% |
| CPU usage | > 95% for 5 min |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Hetzner Server                        │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │   Watchdog   │───▶│  Telegram    │──▶ Your Phone    │
│  │   (PM2)      │    │  Bot API     │                   │
│  └──────┬───────┘    └──────────────┘                   │
│         │                                                │
│         ▼                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 Health Checks                     │   │
│  │  • Docker API    • PM2 API    • HTTP pings       │   │
│  │  • systemctl     • disk/ram   • SSL certs        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js 20 | Already on server, consistent with other apps |
| Process Manager | PM2 | Already in use, handles restarts |
| HTTP Client | Native fetch | No dependencies needed |
| Telegram | node-telegram-bot-api | Simple, well-maintained |
| Scheduling | node-cron | Lightweight, familiar syntax |
| Config | .env file | Simple, secure |

## Project Structure

```
/home/mmmadmin/watchdog/
├── src/
│   ├── index.js           # Entry point, scheduler
│   ├── checks/
│   │   ├── docker.js      # Docker container checks
│   │   ├── pm2.js         # PM2 process checks
│   │   ├── systemd.js     # System service checks
│   │   ├── http.js        # HTTP endpoint checks
│   │   └── resources.js   # Disk/RAM/CPU checks
│   ├── notifier.js        # Telegram notification logic
│   ├── state.js           # Track what's already alerted
│   └── config.js          # Load config from env
├── .env                   # Secrets (gitignored)
├── .env.example           # Template
├── package.json
├── ecosystem.config.js    # PM2 config
└── README.md
```

## Configuration

### Environment Variables (.env)

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Check intervals (seconds)
CHECK_INTERVAL_SERVICES=60
CHECK_INTERVAL_ENDPOINTS=300
CHECK_INTERVAL_RESOURCES=300

# Thresholds
DISK_THRESHOLD_PERCENT=85
RAM_THRESHOLD_PERCENT=90
CPU_THRESHOLD_PERCENT=95

# Alerting
ALERT_COOLDOWN_MINUTES=30
RECOVERY_NOTIFY=true
```

### Services Configuration (config.js)

```javascript
export const services = {
  docker: [
    { name: 'ai-service', httpCheck: 'http://localhost:3001/health' },
    { name: 'mmm-tts', httpCheck: 'http://localhost:8000/health' },
    { name: 'polybet-web', httpCheck: 'http://localhost:8001' },
    { name: 'polybet-grafana' },
    { name: 'polybet-prometheus' },
    { name: 'polybet-postgres' },
    { name: 'polybet-redis' },
  ],
  pm2: [
    { name: 'iossubmissionguide', httpCheck: 'http://localhost:3000' },
    { name: 'iosguide-api', httpCheck: 'http://localhost:3005' },
    { name: 'watchmyplace-api', httpCheck: 'http://localhost:4000' },
  ],
  systemd: ['nginx', 'postgresql@16-main', 'redis-server', 'fail2ban'],
  endpoints: [
    'https://ai.mymaternalmind.com',
    'https://tts.mymaternalmind.com',
    'https://iossubmissionguide.com',
    'https://sieggg.com',
    'https://mirramoments.com',
    'https://watchmyplace.app',
  ],
};
```

## Alert Logic

### State Management

Keep track of current failures to avoid alert spam:

```javascript
// state.js
const state = {
  failures: new Map(),      // service -> { since, lastAlert }
  acknowledged: new Set(),  // manually silenced
};
```

### Alert Rules

1. **First failure:** Alert immediately
2. **Ongoing failure:** Re-alert every `ALERT_COOLDOWN_MINUTES`
3. **Recovery:** Alert when service comes back (if `RECOVERY_NOTIFY=true`)
4. **Flapping:** If service fails/recovers 3+ times in 10 min, alert once and suppress

### Message Format

```
🔴 SERVICE DOWN

Service: mmm-tts
Type: Docker container
Since: 14:32 (2 min ago)
Error: Container exited with code 1

Last 5 log lines:
> Error: ECONNREFUSED...
> ...
```

```
🟢 SERVICE RECOVERED

Service: mmm-tts
Type: Docker container
Downtime: 4 minutes
```

```
⚠️ RESOURCE WARNING

Disk usage: 87% (262GB / 301GB)
Threshold: 85%

Top directories:
/var/www: 45GB
/home/mmmadmin: 38GB
```

## Telegram Bot Setup

1. Create bot via @BotFather on Telegram
2. Get the bot token
3. Start a chat with the bot
4. Get your chat ID (send a message, then call `getUpdates`)
5. Add token and chat ID to `.env`

### Bot Commands (Optional Enhancement)

| Command | Action |
|---------|--------|
| /status | Show current status of all services |
| /mute [service] [duration] | Silence alerts for a service |
| /unmute [service] | Re-enable alerts |
| /disk | Show disk usage breakdown |
| /restart [service] | Restart a PM2/Docker service |

## Health Check Implementation

### Docker Check

```javascript
import { execSync } from 'child_process';

export function checkDocker(containerName) {
  try {
    const status = execSync(
      `docker inspect --format='{{.State.Health.Status}}' ${containerName}`,
      { encoding: 'utf8' }
    ).trim();
    
    return status === 'healthy' || status === 'running';
  } catch {
    return false;
  }
}
```

### PM2 Check

```javascript
export function checkPM2(processName) {
  try {
    const list = execSync('pm2 jlist', { encoding: 'utf8' });
    const processes = JSON.parse(list);
    const proc = processes.find(p => p.name === processName);
    
    return proc?.pm2_env?.status === 'online';
  } catch {
    return false;
  }
}
```

### HTTP Check

```javascript
export async function checkHTTP(url, timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    return res.ok;
  } catch {
    return false;
  }
}
```

### Resource Check

```javascript
export function checkDisk() {
  const output = execSync("df -h / | tail -1 | awk '{print $5}'", { encoding: 'utf8' });
  return parseInt(output.replace('%', ''));
}

export function checkRAM() {
  const output = execSync("free | grep Mem | awk '{print ($3/$2) * 100}'", { encoding: 'utf8' });
  return parseFloat(output);
}
```

## Deployment

### Install

```bash
cd /home/mmmadmin
git clone <repo> watchdog
cd watchdog
npm install
cp .env.example .env
nano .env  # Add Telegram credentials
```

### PM2 Setup

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'watchdog',
    script: 'src/index.js',
    node_args: '--experimental-modules',
    env: {
      NODE_ENV: 'production',
    },
    // Self-monitoring: restart if watchdog itself crashes
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
  }],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
```

### Nginx (Optional - for status page)

If you want a web status page later:

```nginx
# /etc/nginx/sites-available/status.sieggg.com
server {
    server_name status.sieggg.com;
    
    location / {
        proxy_pass http://localhost:3100;
    }
}
```

## Self-Monitoring

The watchdog needs to monitor itself. Options:

1. **PM2 auto-restart:** Built-in, handles crashes
2. **External ping:** Use a free service like UptimeRobot to ping a `/health` endpoint
3. **Systemd backup:** Create a systemd unit that starts watchdog if PM2 fails

Recommended: Use UptimeRobot (free tier) to ping `https://sieggg.com/watchdog-health` every 5 minutes. This gives you external monitoring of the monitor.

## Development Phases

### Phase 1: MVP (Day 1)
- [ ] Basic project setup
- [ ] Docker container checks
- [ ] PM2 process checks
- [ ] Telegram notifications
- [ ] Deploy with PM2

### Phase 2: Full Coverage (Day 2)
- [ ] Systemd service checks
- [ ] HTTP endpoint checks
- [ ] Resource monitoring (disk/RAM)
- [ ] Alert cooldown logic
- [ ] Recovery notifications

### Phase 3: Polish (Day 3)
- [ ] Telegram bot commands (/status, /mute)
- [ ] Status page (optional)
- [ ] SSL certificate expiry checks
- [ ] Log aggregation on failures

## Dependencies

```json
{
  "name": "watchdog",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.66.0",
    "node-cron": "^3.0.3",
    "dotenv": "^16.4.5"
  }
}
```

Total: 3 dependencies, minimal footprint.

## Estimated Effort

| Phase | Time |
|-------|------|
| Phase 1 (MVP) | 2-3 hours |
| Phase 2 (Full) | 2-3 hours |
| Phase 3 (Polish) | 2-4 hours |
| **Total** | **6-10 hours** |

## Future Enhancements

- **Metrics history:** Store check results in SQLite for trending
- **Dashboard:** Simple web UI showing service status
- **Slack/Discord:** Add alternative notification channels
- **Anomaly detection:** Alert on unusual patterns (high latency, error rate spikes)
- **SSL monitoring:** Alert 14 days before certificate expiry
