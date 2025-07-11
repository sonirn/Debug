// MongoDB Atlas Connection Test
const { MongoClient } = require('mongodb');

async function testMongoDBConnection() {
  console.log('🧪 Testing MongoDB Atlas Connection...');
  
  const mongoUrl = 'mongodb+srv://sonirn420:Sonirn420@debug.qprc9b.mongodb.net/apk_converter?retryWrites=true&w=majority&appName=Debug';
  
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    const client = new MongoClient(mongoUrl);
    
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas!');
    
    const db = client.db('apk_converter');
    console.log('✅ Database selected: apk_converter');
    
    // Test ping
    await db.admin().ping();
    console.log('✅ MongoDB Atlas ping successful!');
    
    // Test collection creation
    const collection = db.collection('jobs');
    console.log('✅ Jobs collection reference created');
    
    // Test insert
    const testJob = {
      _id: 'test-job-' + Date.now(),
      status: 'test',
      createdAt: new Date()
    };
    
    await collection.insertOne(testJob);
    console.log('✅ Test document inserted');
    
    // Test find
    const foundJob = await collection.findOne({ _id: testJob._id });
    console.log('✅ Test document found:', foundJob ? 'YES' : 'NO');
    
    // Test delete
    await collection.deleteOne({ _id: testJob._id });
    console.log('✅ Test document deleted');
    
    await client.close();
    console.log('✅ Connection closed');
    
    console.log('\n🎉 MongoDB Atlas connection test PASSED!');
    return true;
    
  } catch (error) {
    console.error('❌ MongoDB Atlas connection test FAILED:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.message.includes('authentication failed')) {
      console.error('🔐 Authentication issue - check username/password');
    }
    
    if (error.message.includes('network')) {
      console.error('🌐 Network issue - check connection string');
    }
    
    return false;
  }
}

testMongoDBConnection();