# Docker Deployment Guide

Complete guide for running Watchdog in Docker.

## Quick Start

### 1. Create .env File

```bash
cp .env.example .env
nano .env
```

Add your Telegram credentials:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3100
```

### 2. Start with Docker Compose (Recommended)

```bash
docker-compose up -d
```

### 3. View Logs

```bash
docker-compose logs -f watchdog
```

### 4. Access Dashboard

Open http://localhost:3100

## Manual Docker Run

```bash
# Build image
docker build -t watchdog:latest .

# Run container
docker run -d \
  --name watchdog \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $(pwd)/state.json:/app/state.json \
  -v $(pwd)/logs:/app/logs \
  -p 3100:3100 \
  --env-file .env \
  watchdog:latest
```

## What Gets Monitored in Docker

### ✅ Can Monitor

- **Docker Containers**: Full support (via mounted socket)
- **HTTP Endpoints**: Full support
- **System Resources**: Container's resources
- **SSL Certificates**: Full support

### ⚠️ Limited Monitoring

- **PM2 Processes**: Only if running inside container
- **systemd Services**: Not available in container

### 💡 To Monitor Host PM2/systemd

Use `network_mode: host` in docker-compose.yml:

```yaml
services:
  watchdog:
    network_mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

**Note**: This gives container full network access to host.

## Configuration

### Environment Variables

Pass via `.env` file or directly:

```yaml
services:
  watchdog:
    environment:
      - TELEGRAM_BOT_TOKEN=your_token
      - TELEGRAM_CHAT_ID=your_chat_id
      - DASHBOARD_ENABLED=true
      - DASHBOARD_PORT=3100
      - CHECK_INTERVAL_SERVICES=60000
```

### Custom Configuration

Mount a YAML config file:

```yaml
services:
  watchdog:
    volumes:
      - ./watchdog.config.yml:/app/watchdog.config.yml:ro
```

## Docker Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f watchdog

# View logs (last 100 lines)
docker-compose logs --tail=100 watchdog

# Check status
docker-compose ps

# Execute command in container
docker-compose exec watchdog sh

# Update and restart
git pull
docker-compose build
docker-compose up -d
```

## Health Check

The container includes a health check:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' watchdog

# Manual health check
curl http://localhost:3100/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 12345,
  "version": "1.0.0"
}
```

## Volumes Explained

```yaml
volumes:
  # Docker socket (read-only) - Monitor Docker containers
  - /var/run/docker.sock:/var/run/docker.sock:ro

  # State persistence - Survives container restarts
  - ./state.json:/app/state.json

  # Logs - View logs on host
  - ./logs:/app/logs

  # Discovered services - See what was found
  - ./discovered-services.yml:/app/discovered-services.yml
```

## Security Considerations

### Docker Socket Access

Mounting the Docker socket gives Watchdog **read access** to Docker:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro  # Read-only
```

**What Watchdog can do:**
- ✅ List containers
- ✅ Inspect container status
- ✅ Read container health checks

**What Watchdog cannot do:**
- ❌ Start/stop containers
- ❌ Create/delete containers
- ❌ Modify containers

### Non-root User

Container runs as `node` user (non-root) by default.

### Resource Limits

Set in docker-compose.yml:

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'      # Max 50% of one CPU
      memory: 256M     # Max 256MB RAM
```

## Troubleshooting

### Container Exits Immediately

Check logs:
```bash
docker-compose logs watchdog
```

Common issues:
- Missing `.env` file
- Invalid Telegram credentials
- Port 3100 already in use

### Can't Access Dashboard

```bash
# Check if port is exposed
docker-compose ps

# Check container is running
docker ps | grep watchdog

# Check logs for errors
docker-compose logs watchdog
```

### No Docker Containers Detected

Ensure Docker socket is mounted:
```bash
docker-compose exec watchdog ls -l /var/run/docker.sock
```

Should show: `srw-rw---- ... /var/run/docker.sock`

### Permission Denied on state.json

```bash
# Fix permissions on host
chmod 666 state.json logs/*.log

# Or run container as host user
docker-compose run --user $(id -u):$(id -g) watchdog
```

## Production Deployment

### Hetzner Server

```bash
# SSH to server
ssh root@your-server

# Clone repo
cd /opt
git clone https://github.com/mymmind/watchdog.git
cd watchdog

# Configure
cp .env.example .env
nano .env  # Add credentials

# Start
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name watchdog.yourdomain.com;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d watchdog.yourdomain.com
```

## Updates

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# Check new version is running
docker-compose logs watchdog | head -20
```

## Backup

```bash
# Backup state and config
tar -czf watchdog-backup.tar.gz .env state.json logs/
```

## Monitoring Multiple Servers

Deploy one Watchdog container per server, each with its own Telegram bot:

```bash
# Server 1
TELEGRAM_BOT_TOKEN=bot1_token docker-compose up -d

# Server 2
TELEGRAM_BOT_TOKEN=bot2_token docker-compose up -d
```

Or use same bot with different chat IDs:

```bash
# Server 1
TELEGRAM_CHAT_ID=chat1_id docker-compose up -d

# Server 2
TELEGRAM_CHAT_ID=chat2_id docker-compose up -d
```

## Docker Hub (Future)

Once published to Docker Hub:

```yaml
services:
  watchdog:
    image: mymmind/watchdog:latest
    # ... rest of config
```

```bash
docker pull mymmind/watchdog:latest
```

## Development

Build and test locally:

```bash
# Build
docker build -t watchdog:dev .

# Run with local code mount
docker run -it --rm \
  -v $(pwd)/src:/app/src \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --env-file .env \
  watchdog:dev

# Run tests in container
docker run --rm watchdog:dev npm test
```

## FAQ

**Q: Can I monitor host PM2 processes from Docker?**
A: Use `network_mode: host` but this reduces container isolation.

**Q: How much resources does the container use?**
A: ~50MB RAM idle, <1% CPU. Limits: 256MB RAM, 0.5 CPU.

**Q: Can I run multiple Watchdog containers?**
A: Yes, but use different ports and state files.

**Q: Does it work on ARM (Raspberry Pi)?**
A: Yes! Use `node:20-alpine` which supports ARM64.

---

**Prefer non-Docker?** See [README.md](README.md) for native installation.
