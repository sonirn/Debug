#!/bin/bash

# Quick file transfer script for VPS deployment
# This script helps you transfer all necessary files to your VPS

echo "📦 Preparing files for VPS deployment..."

# Create deployment package
mkdir -p deployment-package

# Copy all necessary files
echo "Copying application files..."
cp -r app/ deployment-package/
cp -r lib/ deployment-package/
cp -r components/ deployment-package/
cp package.json deployment-package/
cp yarn.lock deployment-package/
cp .env deployment-package/
cp Dockerfile deployment-package/
cp docker-compose.yml deployment-package/
cp deploy.sh deployment-package/
cp README_DEPLOYMENT.md deployment-package/
cp tailwind.config.js deployment-package/
cp postcss.config.js deployment-package/
cp next.config.js deployment-package/ 2>/dev/null || true

# Create production env template
cat > deployment-package/.env.production << 'EOF'
# Production Environment Variables
NODE_ENV=production

# MongoDB Configuration (Your working MongoDB Atlas connection)
MONGO_URL=mongodb+srv://sonirn420:Sonirn420@debug.qprc9b.mongodb.net/apk_converter?retryWrites=true&w=majority&appName=Debug
DB_NAME=apk_converter

# Application Configuration - UPDATE WITH YOUR DOMAIN
NEXT_PUBLIC_BASE_URL=http://your-domain.com:3000
API_KEY=your-production-api-key-here

# Optional: SSL Configuration
# SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
# SSL_KEY_PATH=/etc/nginx/ssl/key.pem
EOF

echo "Creating deployment archive..."
tar -czf apk-converter-deployment.tar.gz deployment-package/

echo "✅ Deployment package created: apk-converter-deployment.tar.gz"
echo
echo "🚀 To deploy to your VPS:"
echo "1. Transfer the archive to your VPS:"
echo "   scp apk-converter-deployment.tar.gz user@your-vps-ip:~/"
echo
echo "2. On your VPS, extract and deploy:"
echo "   tar -xzf apk-converter-deployment.tar.gz"
echo "   cd deployment-package"
echo "   chmod +x deploy.sh"
echo "   ./deploy.sh"
echo
echo "3. Access your application at: http://your-vps-ip:3000"
echo

# Clean up
rm -rf deployment-package/