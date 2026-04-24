# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
# Explicitly install build dependencies for frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy frontend source and compile
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Backend Server
FROM node:20-alpine
WORKDIR /app

# Copy backend package management
COPY package.json package-lock.json* ./
RUN npm ci --only=production
# Add tsx explicitly to support the hybrid TS architecture
RUN npm install -g tsx

# Copy all node backend source scripts
COPY src/ ./src/
COPY cdn-sdk/ ./cdn-sdk/
COPY db.js ./
COPY subscription-auth.js ./

# Mount the compiled frontend from Stage 1 into the target delivery directory
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist



# Expose Web Port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start Engine via TSX (Supports strict TypeScript models)
CMD ["tsx", "src/server.js"]