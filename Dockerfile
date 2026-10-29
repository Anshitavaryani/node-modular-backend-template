# API image. Build once, then run migrations and seeds with the same image (see docker-compose.yml).
FROM node:26-trixie-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:26-trixie-slim
ENV NODE_ENV=production \
    PORT=5000 \
    STORAGE_DIR=/app/storage
# mariadb-dump, for npm run backup.
RUN apt-get update \
    && apt-get install -y --no-install-recommends mariadb-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Runtime files (uploads, logs, backups) live in /app/storage, which compose mounts as a volume. The node user owns it.
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT||5000) + '/api/healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
