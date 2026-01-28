#!/bin/bash
# Watchdog Deployment Script for Remote Server (No Git Required)

set -e  # Exit on error

# Configuration - UPDATE THESE VALUES FOR YOUR SERVER
SERVER_USER="your-server-user"
SERVER_HOST="your-server-ip-or-domain"
DEPLOY_PATH="/home/your-server-user/watchdog"
TARBALL="watchdog-deploy.tar.gz"

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

# Create tarball with necessary files
echo "📦 Creating deployment package..."
tar -czf $TARBALL \
    src/ \
    config/ \
    Dockerfile \
    docker-compose.yml \
    package.json \
    package-lock.json \
    .dockerignore

echo "✅ Package created: $TARBALL"
echo ""

# Create deployment directory on server
echo "📁 Creating deployment directory..."
ssh $SERVER_USER@$SERVER_HOST "mkdir -p $DEPLOY_PATH"

# Copy tarball to server
echo "📤 Uploading package to server..."
scp $TARBALL $SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/

# Copy .env file
echo "📤 Copying .env file..."
scp .env $SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/.env

# Extract and start on server
echo ""
echo "🚀 Deploying on server..."

ssh $SERVER_USER@$SERVER_HOST << ENDSSH
set -e
cd $DEPLOY_PATH

# Extract tarball
echo "📦 Extracting files..."
tar -xzf $TARBALL
rm $TARBALL

# Create empty files if they don't exist
touch state.json discovered-services.yml

# Stop if already running
echo "🛑 Stopping existing container..."
docker compose down 2>/dev/null || true

# Rebuild and start
echo "🏗️  Building and starting container..."
docker compose up -d --build

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
ENDSSH

# Clean up local tarball
rm $TARBALL

echo ""
echo "🎉 Watchdog is now running on your server!"
echo ""
echo "📊 To view logs, run:"
echo "   ssh $SERVER_USER@$SERVER_HOST 'cd $DEPLOY_PATH && docker compose logs -f watchdog'"
echo ""
echo "🌐 To access dashboard, create SSH tunnel:"
echo "   ssh -L 3100:localhost:3100 $SERVER_USER@$SERVER_HOST"
echo "   Then open: http://localhost:3100"
echo ""
echo "💬 To test Telegram commands, send these to your bot:"
echo "   /help - Show available commands"
echo "   /status - Get server status"
echo "   /restart docker:container-name - Restart a service"
echo ""
