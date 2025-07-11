# Google Cloud + MongoDB Atlas Deployment Guide

## 🚀 **STEP 1: Create Google Cloud Compute Engine Instance**

### **Instance Configuration:**
```bash
# Create VM instance
gcloud compute instances create apk-converter \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --tags=http-server,https-server
```

### **Recommended Specs:**
- **Machine Type**: e2-medium (2 vCPUs, 4GB RAM)
- **Boot Disk**: 100GB SSD (not 10GB!)
- **OS**: Ubuntu 20.04 LTS
- **Network**: Allow HTTP/HTTPS traffic
- **Cost**: ~$35-40/month

### **Firewall Rules:**
```bash
# Allow HTTP/HTTPS traffic
gcloud compute firewall-rules create allow-http-https \
  --allow tcp:80,tcp:443,tcp:3000 \
  --source-ranges 0.0.0.0/0 \
  --target-tags http-server,https-server
```

## 🗃️ **STEP 2: Setup MongoDB Atlas Cluster**

### **1. Create MongoDB Atlas Account**
- Go to [MongoDB Atlas](https://cloud.mongodb.com)
- Create free account
- Create new project: "APK-Debug-Converter"

### **2. Create Cluster**
```
Cluster Configuration:
├── Provider: Google Cloud Platform
├── Region: us-central1 (same as your VM)
├── Tier: M0 (Free) or M2 ($9/month)
├── Cluster Name: apk-converter-cluster
└── Version: 7.0
```

### **3. Configure Security**
```bash
# Database User
Username: apkConverter
Password: <generate-strong-password>
Role: readWrite

# Network Access
IP Whitelist: 0.0.0.0/0 (or your VM's IP)
```

### **4. Get Connection String**
```
mongodb+srv://apkConverter:<password>@apk-converter-cluster.xxx.mongodb.net/apk_converter?retryWrites=true&w=majority
```

## 🔧 **STEP 3: Application Deployment**

### **1. Connect to Your VM**
```bash
# SSH into your Google Cloud VM
gcloud compute ssh apk-converter --zone=us-central1-a
```

### **2. Install Dependencies**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install system dependencies
sudo apt-get install -y unzip zip build-essential git

# Install PM2
sudo npm install -g pm2

# Install nginx (for reverse proxy)
sudo apt-get install -y nginx
```

### **3. Clone and Setup Application**
```bash
# Clone your repository
git clone <your-repo-url>
cd apk-debug-converter

# Install dependencies
npm install

# Build application
npm run build
```

### **4. Configure Environment Variables**
```bash
# Create .env file
cat > .env << EOF
# MongoDB Atlas Connection
MONGO_URL=mongodb+srv://apkConverter:<password>@apk-converter-cluster.xxx.mongodb.net/apk_converter?retryWrites=true&w=majority
DB_NAME=apk_converter

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Optional: Add monitoring
API_KEY=your-api-key-here
EOF
```

### **5. Start Application**
```bash
# Start with PM2
pm2 start npm --name "apk-converter" -- start

# Setup PM2 startup
pm2 startup
pm2 save

# Check status
pm2 status
```

## 🌐 **STEP 4: Domain and SSL Setup**

### **1. Configure Nginx Reverse Proxy**
```bash
# Create nginx configuration
sudo nano /etc/nginx/sites-available/apk-converter
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Increase file upload limits for APK files
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for APK processing
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }
}
```

### **2. Enable Site and Install SSL**
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/apk-converter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install SSL certificate (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 📊 **STEP 5: Test the Setup**

### **1. Health Check**
```bash
# Test local application
curl http://localhost:3000/api/stats

# Test through nginx
curl http://yourdomain.com/api/stats

# Test HTTPS
curl https://yourdomain.com/api/stats
```

### **2. APK Processing Test**
```bash
# Upload test APK through web interface
# Check MongoDB Atlas for job records
# Verify file processing works
```

## 💰 **COST BREAKDOWN**

### **Google Cloud Compute Engine:**
| **Component** | **Monthly Cost** |
|---|---|
| e2-medium (2 vCPU, 4GB RAM) | $25 |
| 100GB SSD Boot Disk | $17 |
| Network Egress | $5-10 |
| **Subtotal** | **$47-52** |

### **MongoDB Atlas:**
| **Tier** | **Monthly Cost** | **Storage** | **Recommended** |
|---|---|---|---|
| M0 (Free) | $0 | 512MB | Development Only |
| M2 (Shared) | $9 | 2GB | Small Production |
| M10 (Dedicated) | $57 | 10GB | Production |

### **Additional Costs:**
| **Component** | **Monthly Cost** |
|---|---|
| Domain name | $1 |
| SSL Certificate | FREE |
| **Total** | **$48-62/month** |

## 🔧 **OPTIMIZATIONS**

### **1. Update Database Service**
```javascript
// Update /app/lib/database.js
const mongoUrl = process.env.MONGO_URL; // MongoDB Atlas connection string
const dbName = process.env.DB_NAME || 'apk_converter';
```

### **2. Add Monitoring**
```javascript
// Add to your application
app.get('/health', async (req, res) => {
  const stats = await dbService.getJobStats();
  res.json({
    status: 'healthy',
    database: stats.storage,
    jobs: stats.total,
    uptime: process.uptime()
  });
});
```

### **3. Automated Backups**
```bash
# MongoDB Atlas provides automatic backups
# Configure backup schedule in Atlas dashboard
```

## 🚨 **IMPORTANT NOTES**

### **Storage Requirements:**
- **10GB is NOT enough** for APK processing
- **100GB recommended** for production
- **Consider persistent disk** for temp files

### **MongoDB Atlas Free Tier:**
- **Good for testing** and development
- **Limited to 512MB storage** - may fill up quickly
- **Upgrade to M2 ($9/month)** for production

### **Security:**
- Use strong passwords for MongoDB
- Configure IP whitelisting
- Enable MongoDB Atlas encryption
- Use HTTPS for all API calls

## ✅ **ADVANTAGES OF THIS ARCHITECTURE**

1. **Managed Database**: MongoDB Atlas handles backups, updates, scaling
2. **High Availability**: Database cluster with automatic failover
3. **Scalability**: Easy to upgrade both VM and database
4. **Security**: MongoDB Atlas has built-in security features
5. **Monitoring**: Built-in monitoring and alerting
6. **Global**: Can deploy in multiple regions

## 🎯 **NEXT STEPS**

1. **Create Google Cloud account** (if you don't have one)
2. **Setup MongoDB Atlas cluster** (free tier for testing)
3. **Create Compute Engine instance** (100GB storage, not 10GB)
4. **Follow deployment guide** step by step
5. **Test with real APK files**
6. **Configure domain and SSL**
7. **Monitor performance**

This architecture will give you a **production-ready**, **scalable**, and **reliable** APK Debug Mode Converter!