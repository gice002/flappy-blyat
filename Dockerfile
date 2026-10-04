# Use official lightweight Node.js 20 Alpine base image
FROM node:20-alpine AS base

# Set working directory inside container
WORKDIR /app

# Copy package descriptors first for optimal layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source code
COPY server/ ./server/
COPY client/ ./client/

# Expose default port
EXPOSE 3000

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Run as non-root unprivileged node user for security
USER node

# Health check command for Docker & cloud orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Launch application server
CMD ["node", "server/server.js"]
