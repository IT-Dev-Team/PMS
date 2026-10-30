# Stage 1: Dependencies and Build
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Set all required environment variables for build
ARG JWT_SECRET
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_MICROSOFT_CLIENT_ID
ARG NEXT_PUBLIC_MICROSOFT_TENANT_ID
ENV JWT_SECRET=${JWT_SECRET:-temp-build-secret-do-not-use}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-temp-build-secret}
ENV NEXTAUTH_URL=${NEXTAUTH_URL:-https://pms.eih.et}
ENV NEXT_PUBLIC_MICROSOFT_CLIENT_ID=${NEXT_PUBLIC_MICROSOFT_CLIENT_ID:-8f155ce1-2edc-49d7-8e8b-7ed4181b1d3e}
ENV MICROSOFT_CLIENT_SECRET=${MICROSOFT_CLIENT_SECRET:-ixH8Q~mi6Q4IJfLSmB4GM4GftwzgbyzyPpfinbSp}
ENV NEXT_PUBLIC_MICROSOFT_TENANT_ID=${NEXT_PUBLIC_MICROSOFT_TENANT_ID:-01749f33-f17c-4886-bbce-416612559128}
ENV DB_HOST=196.190.220.87
 ENV DB_PORT=5432
ENV DB_NAME=eih_pms
ENV DB_USER=root
ENV DB_PASSWORD="Sys@Eih2025#"
ENV NODE_ENV=production
# Build
RUN pnpm build


# Stage 2: Runtime
FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000

CMD ["pnpm", "start"]