# Watchdog Docker Image
FROM node:20-alpine

# Install system dependencies for monitoring
RUN apk add --no-cache \
    docker-cli \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src ./src
COPY .env.example ./

# Create logs directory
RUN mkdir -p logs

# Set environment variables
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose dashboard port
EXPOSE 3100

# Run as non-root user
USER node

# Start application
CMD ["node", "src/index.js"]
