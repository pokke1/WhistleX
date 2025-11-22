FROM node:20-alpine
WORKDIR /app

# Install backend
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --production=false

# Install frontend
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install --production=false

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
CMD ["npm", "run", "dev"]
