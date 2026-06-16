# Stage 1: Build frontend
FROM node:24-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production server
FROM node:24-slim
WORKDIR /app

# Install OS dependencies for canvas and onnxruntime (glibc required)
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  libgif-dev \
  libpixman-1-dev \
  libfreetype-dev \
  && rm -rf /var/lib/apt/lists/*

# Backend dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY *.js ./
COPY scripts/ ./scripts/

# Copy processed data (questions, OCR text, embedding cache)
COPY data/processed/ ./data/processed/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Environment
ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["node", "server.js"]
