# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Vite env vars are embedded at build-time, so they must be provided during the build stage
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy migration files for db:migrate Job
COPY --from=builder /app/src/db/migrations ./src/db/migrations

# S8: Run as non-root user for defense-in-depth
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

# Expose the port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Default: start the web server
# Override with ["node", "dist/server/worker.js"] for the Graphile Worker service
CMD ["node", "dist/server/index.js"]
