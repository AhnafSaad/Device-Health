# ========================================================
# Stage 1: Build Frontend Assets & Dependencies
# ========================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies if needed
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci || npm install

# Copy application source code
COPY . .

# Build production client bundle via Vite into /app/dist
RUN npm run build

# Prune devDependencies to keep final image lean
RUN npm prune --omit=dev

# ========================================================
# Stage 2: Production Runtime Container
# ========================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production \
    PORT=3000

# Install wget/curl for health check
RUN apk add --no-cache wget curl

# Create and switch to non-root system user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production node_modules from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy compiled frontend distribution assets
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy backend server files, schemas, and configurations
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nodejs:nodejs /app/lib ./lib
COPY --from=builder --chown=nodejs:nodejs /app/schema.sql ./schema.sql

# Set non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Container healthcheck against /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start full-stack server
CMD ["node", "server.ts"]
