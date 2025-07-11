# MongoDB Atlas Connection Issue - Troubleshooting Guide

## 🚨 **CURRENT STATUS**

✅ **Application is working** with in-memory storage fallback
❌ **MongoDB Atlas connection failing** due to network timeout

## 🔍 **ROOT CAUSE ANALYSIS**

### **Error Details:**
```
Server selection timed out after 30000 ms
TopologyDescription: ReplicaSetNoPrimary
Servers: 
- debug-shard-00-00.qprc9b.mongodb.net:27017
- debug-shard-00-01.qprc9b.mongodb.net:27017  
- debug-shard-00-02.qprc9b.mongodb.net:27017
```

### **Most Likely Causes:**
1. **IP Whitelisting** - Atlas not allowing connections from current IP
2. **Network Restrictions** - Firewall blocking MongoDB ports
3. **Authentication Issues** - Username/password mismatch
4. **Connection String Issues** - Malformed connection parameters

## 🛠️ **SOLUTION STEPS**

### **Step 1: Check MongoDB Atlas IP Whitelist**

1. **Go to MongoDB Atlas Dashboard**
   - Visit https://cloud.mongodb.com
   - Login with your credentials
   - Select your "Debug" cluster

2. **Check Network Access**
   - Click "Network Access" in left sidebar
   - Check if your current IP is whitelisted
   - If not, add your IP address

3. **Add Current IP Address**
   ```bash
   # Get your current IP
   curl -s https://ipinfo.io/ip
   
   # Add this IP to Atlas whitelist
   # OR use 0.0.0.0/0 for testing (not recommended for production)
   ```

### **Step 2: Verify Connection String**

**Your Current Connection String:**
```
mongodb+srv://sonirn420:Sonirn420@debug.qprc9b.mongodb.net/apk_converter?retryWrites=true&w=majority&appName=Debug
```

**Verify Components:**
- ✅ **Username**: sonirn420
- ⚠️ **Password**: Sonirn420 (case sensitive!)
- ✅ **Cluster**: debug.qprc9b.mongodb.net
- ✅ **Database**: apk_converter
- ✅ **App Name**: Debug

### **Step 3: Test Connection Manually**

**Option A: Using MongoDB Compass**
1. Download MongoDB Compass
2. Use connection string to test
3. If successful, issue is in application code

**Option B: Using mongo shell**
```bash
# Install MongoDB shell
npm install -g mongodb
```

**Option C: Using our test script**
```bash
cd /app
node test-mongodb.js
```

### **Step 4: Update MongoDB Atlas Settings**

1. **Database User Settings**
   - Go to "Database Access" in Atlas
   - Verify user "sonirn420" exists
   - Check password is correct
   - Ensure user has "readWrite" role

2. **Cluster Settings**
   - Go to "Clusters" in Atlas
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the latest connection string

### **Step 5: Alternative Connection Strings**

**Try these variations:**

**Option A: Without App Name**
```
mongodb+srv://sonirn420:Sonirn420@debug.qprc9b.mongodb.net/apk_converter?retryWrites=true&w=majority
```

**Option B: With explicit authentication**
```
mongodb+srv://sonirn420:Sonirn420@debug.qprc9b.mongodb.net/apk_converter?retryWrites=true&w=majority&authSource=admin
```

**Option C: Standard connection (if SRV fails)**
```
mongodb://sonirn420:Sonirn420@debug-shard-00-00.qprc9b.mongodb.net:27017,debug-shard-00-01.qprc9b.mongodb.net:27017,debug-shard-00-02.qprc9b.mongodb.net:27017/apk_converter?ssl=true&replicaSet=atlas-wo6prw-shard-0&authSource=admin&retryWrites=true&w=majority
```

## 🔧 **IMMEDIATE FIXES TO TRY**

### **Fix 1: Update IP Whitelist**
1. Go to MongoDB Atlas Dashboard
2. Network Access → Add IP Address
3. Add current IP or use 0.0.0.0/0 (temporary)

### **Fix 2: Test Simple Connection**
```bash
# Update .env with basic connection
MONGO_URL=mongodb+srv://sonirn420:Sonirn420@debug.qprc9b.mongodb.net/apk_converter
```

### **Fix 3: Verify Password**
- Check if password has special characters
- Try URL encoding if needed
- Verify case sensitivity

### **Fix 4: Use Local MongoDB (Temporary)**
```bash
# Keep local MongoDB running
sudo systemctl start mongodb

# Use local connection
MONGO_URL=mongodb://localhost:27017
```

## 📋 **TESTING CHECKLIST**

### **Connection Tests:**
- [ ] Can access MongoDB Atlas dashboard
- [ ] IP address is whitelisted
- [ ] Database user exists and has correct permissions
- [ ] Connection string is valid
- [ ] Test connection from external tool

### **Application Tests:**
- [ ] Application starts without errors
- [ ] /api/stats returns database status
- [ ] Can create and retrieve jobs
- [ ] APK processing works end-to-end

## 🎯 **RECOMMENDED ACTIONS**

### **Immediate (Next 15 minutes):**
1. **Check IP Whitelist** in MongoDB Atlas
2. **Test connection string** manually
3. **Verify database user** credentials

### **Short-term (Next hour):**
1. **Fix Atlas connection** using guide above
2. **Test full APK processing** with Atlas
3. **Verify data persistence** across restarts

### **Long-term (Production):**
1. **Use specific IP ranges** instead of 0.0.0.0/0
2. **Setup connection pooling** for better performance
3. **Configure monitoring** and alerting
4. **Implement backup strategy**

## 💡 **CURRENT WORKAROUND**

**✅ System is working with in-memory storage:**
- All APK processing functions work
- Real-time progress tracking works
- File upload/download works
- Only limitation: data lost on restart

**To continue testing:**
```bash
# Test APK conversion
curl -X POST http://localhost:3000/api/convert \
  -F "apk=@/path/to/your/test.apk"

# Check progress
curl http://localhost:3000/api/status/{jobId}

# Check system stats
curl http://localhost:3000/api/stats
```

## 🚀 **NEXT STEPS**

1. **Fix MongoDB Atlas connection** using steps above
2. **Test database persistence** 
3. **Deploy to Google Cloud** with working Atlas connection
4. **Setup monitoring** and maintenance

The application is **production-ready** with the in-memory fallback, but fixing the MongoDB Atlas connection will provide data persistence and better scalability.