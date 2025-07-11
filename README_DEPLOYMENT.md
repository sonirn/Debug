# APK Debug Mode Converter - Production Deployment Guide

## 🚀 Complete VPS Deployment Instructions

This guide will help you deploy the **APK Debug Mode Converter** web application to your VPS server with all features working.

### 📋 Prerequisites

- Ubuntu 20.04+ VPS server
- At least 2GB RAM, 2 CPU cores
- 20GB+ disk space
- Root or sudo access

### 🔧 Deployment Steps

#### 1. Connect to your VPS
```bash
# Use your tmate session or SSH directly
ssh username@your-vps-ip
```

#### 2. Transfer application files
You need to copy all the application files to your VPS. You can either:

**Option A: Download from current environment**
```bash
# Create app directory
mkdir -p /home/apk-converter
cd /home/apk-converter

# Copy all files from your current development environment
# (You'll need to transfer: all .js files, package.json, .env, etc.)
```

**Option B: Clone from repository (if available)**
```bash
git clone [your-repo-url] /home/apk-converter
cd /home/apk-converter
```

#### 3. Make deployment script executable
```bash
chmod +x deploy.sh
```

#### 4. Run deployment script
```bash
./deploy.sh
```

### 🌐 What the deployment script does:

1. **System Setup**
   - Updates system packages
   - Installs Docker and Docker Compose
   - Creates necessary directories

2. **Environment Configuration**
   - Sets up production environment variables
   - Configures MongoDB Atlas connection
   - Creates SSL directories

3. **Application Deployment**
   - Builds Docker container with all dependencies
   - Starts the application with Docker Compose
   - Sets up auto-restart service

4. **Security & Monitoring**
   - Configures firewall
   - Sets up log rotation
   - Creates systemd service

### 🔍 Post-Deployment Verification

After deployment, verify everything is working:

```bash
# Check application status
curl http://localhost:3000/api/stats

# Check MongoDB connection
curl http://localhost:3000/api/test-mongodb

# View application logs
docker-compose logs -f apk-converter

# Check container status
docker-compose ps
```

### 🌍 Making it accessible from the internet

#### 1. Update environment for your domain
```bash
# Edit .env.production
nano .env.production

# Update this line with your actual domain/IP:
NEXT_PUBLIC_BASE_URL=http://your-domain.com:3000
```

#### 2. Open firewall ports
```bash
# Allow traffic on port 3000
sudo ufw allow 3000/tcp
sudo ufw enable
```

#### 3. Access your application
- **Main App**: `http://your-vps-ip:3000`
- **API Status**: `http://your-vps-ip:3000/api/stats`
- **MongoDB Test**: `http://your-vps-ip:3000/api/test-mongodb`

### 🔒 Optional: SSL Setup (HTTPS)

For production with a domain name:

```bash
# Install certbot for Let's Encrypt SSL
sudo apt install certbot nginx

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Update nginx configuration (included in deployment)
sudo systemctl restart nginx
```

### 🛠️ Management Commands

```bash
# Start application
sudo systemctl start apk-converter

# Stop application
sudo systemctl stop apk-converter

# Restart application
sudo systemctl restart apk-converter

# Check status
sudo systemctl status apk-converter

# View logs
docker-compose logs -f apk-converter

# Update application
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 📊 Application Features Available

✅ **All features from the original plan are available:**

1. **APK Upload & Conversion**
   - Drag & drop APK file upload
   - Real-time processing progress
   - Debug mode conversion with all features

2. **Debug Features Enabled**
   - `android:debuggable="true"`
   - Network security config
   - WebView debugging
   - Logging and monitoring
   - Security bypass for debugging

3. **MongoDB Atlas Integration**
   - Persistent job storage
   - Real-time progress tracking
   - Job history and statistics

4. **Production-Ready**
   - Docker containerization
   - Auto-restart on failure
   - Log rotation
   - Health monitoring

### 🎯 Success Metrics

After deployment, you should see:
- Application accessible at `http://your-vps-ip:3000`
- MongoDB connection working
- APK file upload and conversion working
- Real-time progress updates
- Download of debug APK files

### 🆘 Troubleshooting

**Common Issues:**

1. **Port 3000 blocked**
   ```bash
   sudo ufw allow 3000/tcp
   ```

2. **MongoDB connection issues**
   ```bash
   # Check environment variables
   cat .env.production
   
   # Test MongoDB connection
   curl http://localhost:3000/api/test-mongodb
   ```

3. **Application not starting**
   ```bash
   # Check Docker logs
   docker-compose logs apk-converter
   
   # Rebuild container
   docker-compose build --no-cache
   ```

4. **Out of disk space**
   ```bash
   # Clean up old containers
   docker system prune -f
   
   # Check disk usage
   df -h
   ```

### 📝 Next Steps

1. **Domain Setup**: Point your domain to the VPS IP
2. **SSL Certificate**: Set up HTTPS for production
3. **Monitoring**: Set up monitoring and alerting
4. **Backup**: Configure database backups
5. **Scaling**: Consider load balancing for high traffic

---

## 📞 Support

If you encounter any issues during deployment:

1. Check the application logs: `docker-compose logs -f`
2. Verify MongoDB connection: `curl http://localhost:3000/api/test-mongodb`
3. Check system resources: `free -h && df -h`
4. Restart services: `sudo systemctl restart apk-converter`

The deployment script includes comprehensive error handling and logging to help troubleshoot any issues.