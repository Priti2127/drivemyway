FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root for monorepo resolution
COPY package.json ./
COPY backend/shared ./backend/shared

# Copy service files
COPY backend/services/auth/package.json ./backend/services/auth/
COPY backend/services/auth/tsconfig.json ./backend/services/auth/
COPY backend/services/auth/src ./backend/services/auth/src

# Install and build
RUN npm install --workspace=backend/shared --workspace=backend/services/auth
RUN npm run build --workspace=backend/shared
RUN npm run build --workspace=backend/services/auth

# ── Production stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/backend/services/auth/dist ./dist
COPY --from=builder /app/backend/services/auth/package.json ./
COPY --from=builder /app/backend/shared/dist ./node_modules/@drivemyway/shared/dist
COPY --from=builder /app/backend/shared/package.json ./node_modules/@drivemyway/shared/

RUN npm install --production

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]
