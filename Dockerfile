# Production Dockerfile for APK Debug Mode Converter
FROM node:18-alpine

# Install system dependencies for APK processing
RUN apk add --no-cache \
    openjdk11-jdk \
    unzip \
    zip \
    curl \
    bash

# Set Java environment
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk
ENV PATH=$PATH:$JAVA_HOME/bin

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p temp/uploads temp/output

# Build the application
RUN yarn build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/stats || exit 1

# Start the application
CMD ["yarn", "start"]