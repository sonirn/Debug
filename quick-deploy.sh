#!/bin/bash

# APK Debug Mode Converter - One-Command GitHub Deployment
# This script clones from GitHub and deploys automatically

set -e

echo "🚀 Starting APK Debug Mode Converter GitHub deployment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
REPO_URL="https://github.com/sonirn/Debug.git"
APP_DIR="Debug"
DOMAIN=${DOMAIN:-$(curl -s ifconfig.me 2>/dev/null || echo "localhost")}
PORT=${PORT:-3000}

print_header "Cloning repository from GitHub..."

# Remove existing directory if it exists
if [[ -d "$APP_DIR" ]]; then
    print_status "Removing existing directory..."
    rm -rf "$APP_DIR"
fi

# Clone repository
if git clone "$REPO_URL" "$APP_DIR"; then
    print_status "Repository cloned successfully"
else
    print_error "Failed to clone repository. Please check the URL."
    exit 1
fi

# Change to app directory
cd "$APP_DIR"

print_header "Running deployment script..."

# Make deployment script executable
chmod +x deploy.sh

# Set environment variables for deployment
export DOMAIN="$DOMAIN"
export PORT="$PORT"

# Run the deployment script
./deploy.sh

echo
echo "================================================================"
echo -e "${GREEN}🎉 GitHub Deployment Complete!${NC}"
echo "================================================================"
echo
echo "📋 Access your application:"
echo "   • Main App: http://$DOMAIN:$PORT"
echo "   • API Status: http://$DOMAIN:$PORT/api/stats"
echo "   • MongoDB Test: http://$DOMAIN:$PORT/api/test-mongodb"
echo
echo "🔧 Management:"
echo "   • Application directory: $(pwd)"
echo "   • Update: git pull origin main && docker-compose build --no-cache && docker-compose up -d"
echo "   • Logs: docker-compose logs -f apk-converter"
echo "   • Status: sudo systemctl status apk-converter"
echo
echo "================================================================"

print_status "One-command GitHub deployment completed successfully! 🚀"