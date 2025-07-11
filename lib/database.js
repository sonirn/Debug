// Database service for APK Debug Mode Converter
// Handles job storage and retrieval using MongoDB

// Database service for APK Debug Mode Converter
// Handles job storage and retrieval using MongoDB Atlas cluster

import { MongoClient, ServerApiVersion } from 'mongodb';

class DatabaseService {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    this.inMemoryJobs = new Map(); // Initialize in-memory fallback
  }

  async connect() {
    if (this.isConnected && this.db) {
      return this.db;
    }

    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.log('🔄 Max connection attempts reached, using in-memory storage');
      this.useInMemoryFallback();
      return null;
    }

    this.connectionAttempts++;
    
    try {
      const mongoUrl = process.env.MONGO_URL;
      const dbName = process.env.DB_NAME || 'apk_converter';
      
      if (!mongoUrl) {
        console.error('❌ MONGO_URL not found in environment variables');
        this.useInMemoryFallback();
        return null;
      }
      
      console.log(`🔌 Connecting to MongoDB Atlas (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts}):`);
      console.log(`   Database: ${dbName}`);
      console.log(`   Connection: ${mongoUrl.replace(/:[^:@]*@/, ':***@')}`);
      
      // MongoDB Atlas connection options optimized for cloud environments
      const options = {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        serverSelectionTimeoutMS: 30000, // 30 second timeout
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
        w: 'majority'
      };
      
      this.client = new MongoClient(mongoUrl, options);
      
      // Connect with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000);
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      this.db = this.client.db(dbName);
      
      // Test the connection with a simple operation
      console.log('🔍 Testing MongoDB Atlas connection...');
      await this.db.admin().ping();
      
      // Test collection access
      const collection = this.db.collection('jobs');
      await collection.findOne({}, { limit: 1 });
      
      this.isConnected = true;
      this.connectionAttempts = 0; // Reset on successful connection
      
      console.log('✅ Successfully connected to MongoDB Atlas');
      console.log('✅ Database connection test passed');
      
      // Set up connection event listeners
      this.client.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
        this.isConnected = false;
      });
      
      this.client.on('close', () => {
        console.log('🔌 MongoDB connection closed');
        this.isConnected = false;
      });
      
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB Atlas connection failed:', error.message);
      console.error('❌ Error details:', {
        name: error.name,
        code: error.code,
        codeName: error.codeName
      });
      
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        console.log(`🔄 Retrying connection in 2 seconds... (${this.connectionAttempts}/${this.maxConnectionAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.connect();
      } else {
        console.error('❌ All connection attempts failed, falling back to in-memory storage');
        this.useInMemoryFallback();
        return null;
      }
    }
  }

  useInMemoryFallback() {
    console.log('🔄 Falling back to in-memory storage');
    this.inMemoryJobs = new Map();
    this.isConnected = false;
  }

  async saveJob(jobId, jobData) {
    if (!this.isConnected || !this.db) {
      // Use in-memory storage as fallback
      this.inMemoryJobs.set(jobId, {
        ...jobData,
        _id: jobId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return;
    }

    try {
      const collection = this.db.collection('jobs');
      const jobDocument = {
        _id: jobId,
        ...jobData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await collection.replaceOne(
        { _id: jobId },
        jobDocument,
        { upsert: true }
      );
    } catch (error) {
      console.error('❌ Error saving job to database:', error);
      // Fallback to in-memory
      this.inMemoryJobs.set(jobId, {
        ...jobData,
        _id: jobId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  async getJob(jobId) {
    if (!this.isConnected || !this.db) {
      // Use in-memory storage as fallback
      return this.inMemoryJobs.get(jobId) || null;
    }

    try {
      const collection = this.db.collection('jobs');
      const job = await collection.findOne({ _id: jobId });
      return job;
    } catch (error) {
      console.error('❌ Error retrieving job from database:', error);
      // Fallback to in-memory
      return this.inMemoryJobs.get(jobId) || null;
    }
  }

  async updateJobProgress(jobId, progress, currentStep, logs = []) {
    if (!this.isConnected || !this.db) {
      // Use in-memory storage as fallback
      const job = this.inMemoryJobs.get(jobId);
      if (job) {
        job.progress = progress;
        job.currentStep = currentStep;
        job.logs = [...(job.logs || []), ...logs];
        job.updatedAt = new Date();
        this.inMemoryJobs.set(jobId, job);
      }
      return;
    }

    try {
      const collection = this.db.collection('jobs');
      await collection.updateOne(
        { _id: jobId },
        {
          $set: {
            progress,
            currentStep,
            updatedAt: new Date()
          },
          $push: {
            logs: { $each: logs }
          }
        }
      );
    } catch (error) {
      console.error('❌ Error updating job progress:', error);
      // Fallback to in-memory
      const job = this.inMemoryJobs.get(jobId);
      if (job) {
        job.progress = progress;
        job.currentStep = currentStep;
        job.logs = [...(job.logs || []), ...logs];
        job.updatedAt = new Date();
        this.inMemoryJobs.set(jobId, job);
      }
    }
  }

  async addJobLog(jobId, message) {
    const logEntry = `${new Date().toISOString()}: ${message}`;
    
    if (!this.isConnected || !this.db) {
      // Use in-memory storage as fallback
      const job = this.inMemoryJobs.get(jobId);
      if (job) {
        job.logs = [...(job.logs || []), logEntry];
        job.updatedAt = new Date();
        this.inMemoryJobs.set(jobId, job);
      }
      return;
    }

    try {
      const collection = this.db.collection('jobs');
      await collection.updateOne(
        { _id: jobId },
        {
          $push: { logs: logEntry },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (error) {
      console.error('❌ Error adding job log:', error);
      // Fallback to in-memory
      const job = this.inMemoryJobs.get(jobId);
      if (job) {
        job.logs = [...(job.logs || []), logEntry];
        job.updatedAt = new Date();
        this.inMemoryJobs.set(jobId, job);
      }
    }
  }

  async completeJob(jobId, result) {
    if (!this.isConnected || !this.db) {
      // Use in-memory storage as fallback
      const job = this.inMemoryJobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.result = result;
        job.completedAt = new Date();
        job.updatedAt = new Date();
        this.inMemoryJobs.set(jobId, job);
      }
      return;
    }

    try {
      const collection = this.db.collection('jobs');
      await collection.updateOne(
        { _id: jobId },
        {
          $set: {
            status: 'completed',
            result,
            completedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      console.error('❌ Error completing job:', error);
      // Fallback to in-memory
      const job = this.inMemoryJobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.result = result;
        job.completedAt = new Date();
        job.updatedAt = new Date();
        this.inMemoryJobs.set(jobId, job);
      }
    }
  }

  async errorJob(jobId, error) {
    if (!this.isConnected || !this.db) {
      // Use in-memory storage as fallback
      const job = this.inMemoryJobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = error;
        job.completedAt = new Date();
        job.updatedAt = new Date();
        this.inMemoryJobs.set(jobId, job);
      }
      return;
    }

    try {
      const collection = this.db.collection('jobs');
      await collection.updateOne(
        { _id: jobId },
        {
          $set: {
            status: 'error',
            error,
            completedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      console.error('❌ Error updating job error:', error);
      // Fallback to in-memory
      const job = this.inMemoryJobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = error;
        job.completedAt = new Date();
        job.updatedAt = new Date();
        this.inMemoryJobs.set(jobId, job);
      }
    }
  }

  async cleanupOldJobs(maxAgeHours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

    if (!this.isConnected || !this.db) {
      // Clean up in-memory storage
      for (const [jobId, job] of this.inMemoryJobs.entries()) {
        if (job.createdAt < cutoffDate) {
          this.inMemoryJobs.delete(jobId);
        }
      }
      return;
    }

    try {
      const collection = this.db.collection('jobs');
      const result = await collection.deleteMany({
        createdAt: { $lt: cutoffDate }
      });
      
      console.log(`🧹 Cleaned up ${result.deletedCount} old jobs`);
    } catch (error) {
      console.error('❌ Error cleaning up old jobs:', error);
    }
  }

  async getJobStats() {
    if (!this.isConnected || !this.db) {
      // In-memory stats
      const total = this.inMemoryJobs.size;
      const processing = Array.from(this.inMemoryJobs.values()).filter(job => job.status === 'processing').length;
      const completed = Array.from(this.inMemoryJobs.values()).filter(job => job.status === 'completed').length;
      const errors = Array.from(this.inMemoryJobs.values()).filter(job => job.status === 'error').length;
      
      return { total, processing, completed, errors, storage: 'in-memory' };
    }

    try {
      const collection = this.db.collection('jobs');
      const stats = await collection.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).toArray();
      
      const result = { total: 0, processing: 0, completed: 0, errors: 0, storage: 'mongodb' };
      stats.forEach(stat => {
        result.total += stat.count;
        if (stat._id === 'processing') result.processing = stat.count;
        if (stat._id === 'completed') result.completed = stat.count;
        if (stat._id === 'error') result.errors = stat.count;
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error getting job stats:', error);
      return { total: 0, processing: 0, completed: 0, errors: 0, storage: 'error' };
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('✅ Disconnected from MongoDB');
    }
  }
}

// Create singleton instance
const dbService = new DatabaseService();

// Initialize connection
dbService.connect();

export default dbService;