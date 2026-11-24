# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1: Build Vite production bundle
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy application source & static 3D/GIS assets
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public

# Build static production assets into /app/dist
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve via hardened Nginx tuned for WebGL 2 / GLB / GIS assets
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="深圳漫游 · BAYWALK" \
      org.opencontainers.image.description="1:1 real-world 3D open-world recreation of Shenzhen Bay & Talent Park in Three.js" \
      org.opencontainers.image.source="https://github.com/DeaglePC/shenzhen-baywalk"

# Replace default site config with WebGL/3D-optimized Nginx config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static site & assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
