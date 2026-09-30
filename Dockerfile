FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    MEDIA_STORAGE_DIR=/app/storage/media

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

COPY . .
RUN npm run build \
    && mkdir -p /app/storage/media \
    && chown -R node:node /app/.next /app/storage/media

USER node
EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
