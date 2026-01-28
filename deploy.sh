#!/bin/bash
# Watchdog Deployment Script for Remote Server

set -e  # Exit on error

# Configuration
SERVER_USER="mmmadmin"
SERVER_HOST="46.224.21.200"
DEPLOY_PATH="/home/mmmadmin/watchdog"

echo "🐕 Watchdog Deployment Script"
echo "================================"
echo "Server: $SERVER_USER@$SERVER_HOST"
echo "Path: $DEPLOY_PATH"
echo ""

# Check if .env exists locally
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Create .env file with your Telegram credentials first."
    exit 1
fi

echo "✅ .env file found"
echo ""

# Deploy
echo "📦 Deploying to server..."
echo ""

ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
set -e

# Create deployment directory
mkdir -p ~/watchdog
cd ~/watchdog

# Clone or update repository
if [ -d .git ]; then
    echo "📥 Updating repository..."
    git pull
else
    echo "📥 Cloning repository..."
    git clone https://github.com/mymmind/watchdog.git .
fi

echo "✅ Repository ready"
ENDSSH

echo ""
echo "📤 Copying .env file to server..."
scp .env $SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/.env

echo ""
echo "🚀 Starting Watchdog..."

ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd ~/watchdog

# Stop if already running
docker compose down 2>/dev/null || true

# Start with Docker Compose
docker compose up -d

echo ""
echo "⏳ Waiting for Watchdog to start..."
sleep 5

# Check status
docker compose ps

echo ""
echo "📋 Recent logs:"
docker compose logs --tail=30 watchdog

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 View logs: cd ~/watchdog && docker compose logs -f watchdog"
echo "🔍 Check status: cd ~/watchdog && docker compose ps"
echo "🌐 Dashboard: http://localhost:3100 (via SSH tunnel)"
ENDSSH

echo ""
echo "🎉 Watchdog is now running on your server!"
echo ""
echo "📊 To view logs, run:"
echo "   ssh $SERVER_USER@$SERVER_HOST 'cd ~/watchdog && docker compose logs -f'"
echo ""
echo "🌐 To access dashboard, create SSH tunnel:"
echo "   ssh -L 3100:localhost:3100 $SERVER_USER@$SERVER_HOST"
echo "   Then open: http://localhost:3100"
echo ""
