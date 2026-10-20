FROM node:20-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NO_OPEN=1

WORKDIR /app

# Dependencias primero (aprovecha la caché de capas)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend ./backend
COPY frontend ./frontend

# Sin privilegios de root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/auth/login || exit 1

CMD ["node", "backend/server.js"]
