# Stage 1: Build Frontend
FROM node:20-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine as backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy backend build and dependencies
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/package*.json ./
COPY --from=backend-build /app/backend/prisma ./prisma

# Copy frontend build to public folder served by backend
COPY --from=frontend-build /app/frontend/dist ./public

# Expose port
EXPOSE 3000

# Start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
