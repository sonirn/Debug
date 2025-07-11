#!/bin/bash

# APK Debug Mode Converter - Production Deployment Script
# This script deploys the complete web application to your VPS

set -e

echo "🚀 Starting APK Debug Mode Converter deployment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="apk-debug-converter"
DOMAIN=${DOMAIN:-"localhost"}
PORT=${PORT:-3000}

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check if required files exist
print_header "Checking required files..."
required_files=("package.json" "app/page.js" "app/api/[[...path]]/route.js" "lib/database.js")
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        print_error "Required file $file not found!"
        exit 1
    fi
done
print_status "All required files present"

# Update system packages
print_header "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose
print_header "Installing Docker and Docker Compose..."
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    sudo usermod -aG docker $USER
    print_status "Docker installed successfully"
else
    print_status "Docker already installed"
fi

if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully"
else
    print_status "Docker Compose already installed"
fi

# Create production environment file
print_header "Setting up environment variables..."
if [[ ! -f ".env.production" ]]; then
    cat > .env.production << EOF
# Production Environment Variables
NODE_ENV=production

# MongoDB Configuration (Keep your existing MongoDB Atlas connection)
MONGO_URL=mongodb+srv://sonirn420:Sonirn420@debug.qprc9b.mongodb.net/apk_converter?retryWrites=true&w=majority&appName=Debug
DB_NAME=apk_converter

# Application Configuration
NEXT_PUBLIC_BASE_URL=http://${DOMAIN}:${PORT}
API_KEY=your-production-api-key-here

# Optional: SSL Configuration (uncomment if using HTTPS)
# SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
# SSL_KEY_PATH=/etc/nginx/ssl/key.pem
EOF
    print_status "Environment file created at .env.production"
    print_warning "Please update NEXT_PUBLIC_BASE_URL with your actual domain"
else
    print_status "Environment file already exists"
fi

# Create necessary directories
print_header "Creating application directories..."
mkdir -p temp/uploads temp/output logs ssl

# Set proper permissions
print_header "Setting directory permissions..."
chmod 755 temp temp/uploads temp/output
chmod 644 .env.production

# Build and start the application
print_header "Building and starting the application..."
docker-compose --env-file .env.production down --remove-orphans
docker-compose --env-file .env.production build --no-cache
docker-compose --env-file .env.production up -d

# Wait for services to be ready
print_header "Waiting for services to start..."
sleep 30

# Check if application is running
print_header "Checking application status..."
if curl -f http://localhost:${PORT}/api/stats > /dev/null 2>&1; then
    print_status "Application is running successfully!"
else
    print_error "Application failed to start. Checking logs..."
    docker-compose --env-file .env.production logs apk-converter
    exit 1
fi

# Setup log rotation
print_header "Setting up log rotation..."
sudo tee /etc/logrotate.d/apk-converter > /dev/null << EOF
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

# Create systemd service for auto-restart
print_header "Creating systemd service..."
sudo tee /etc/systemd/system/apk-converter.service > /dev/null << EOF
[Unit]
Description=APK Debug Mode Converter
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=/usr/local/bin/docker-compose --env-file .env.production up -d
ExecStop=/usr/local/bin/docker-compose --env-file .env.production down
User=$USER
Group=$USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable apk-converter
print_status "Systemd service created and enabled"

# Setup firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    print_header "Configuring firewall..."
    sudo ufw allow ${PORT}/tcp
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    print_status "Firewall configured"
fi

# Final status check
print_header "Final deployment verification..."
sleep 10

# Check MongoDB connection
if curl -f http://localhost:${PORT}/api/test-mongodb > /dev/null 2>&1; then
    print_status "MongoDB connection: ✅ Working"
else
    print_warning "MongoDB connection: ❌ Check logs"
fi

# Check stats endpoint
if curl -f http://localhost:${PORT}/api/stats > /dev/null 2>&1; then
    print_status "API endpoints: ✅ Working"
else
    print_error "API endpoints: ❌ Not responding"
fi

# Display final information
echo
echo "================================================================"
echo -e "${GREEN}🎉 APK Debug Mode Converter Deployment Complete!${NC}"
echo "================================================================"
echo
echo "📋 Deployment Summary:"
echo "   • Application URL: http://${DOMAIN}:${PORT}"
echo "   • API Status: http://${DOMAIN}:${PORT}/api/stats"
echo "   • MongoDB Test: http://${DOMAIN}:${PORT}/api/test-mongodb"
echo "   • Container Status: docker-compose ps"
echo "   • Application Logs: docker-compose logs -f apk-converter"
echo
echo "🔧 Management Commands:"
echo "   • Start: docker-compose --env-file .env.production up -d"
echo "   • Stop: docker-compose --env-file .env.production down"
echo "   • Restart: sudo systemctl restart apk-converter"
echo "   • Status: sudo systemctl status apk-converter"
echo "   • Logs: docker-compose --env-file .env.production logs -f"
echo
echo "🌐 Next Steps:"
echo "   1. Update DNS to point your domain to this server"
echo "   2. Set up SSL certificate (Let's Encrypt recommended)"
echo "   3. Update NEXT_PUBLIC_BASE_URL in .env.production"
echo "   4. Test APK conversion functionality"
echo
echo "================================================================"

print_status "Deployment completed successfully! 🚀"