# syntax=docker/dockerfile:1

# Development stage used by docker-compose for local workflow
FROM node:20-alpine AS dev
WORKDIR /app

# Install backend deps
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --production=false

# Install frontend deps
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install --production=false

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
CMD ["npm", "run", "dev"]

# Build stage for production backend image
FROM node:20-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci
COPY backend ./
RUN npm run build && npm prune --omit=dev

# Hardened runtime stage (non-root, minimal production payload)
FROM node:20-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production

COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/package-lock.json ./package-lock.json
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app/backend
USER app

EXPOSE 4000
CMD ["npm", "start"]
