// Firebase Integration Test for APK Debug Mode Converter
// Tests the Firebase Admin SDK authentication and Firestore connectivity

// Load environment variables
require('dotenv').config();

const { adminDb } = require('./lib/firebase-admin.js');

async function testFirebaseConnection() {
    console.log('🔥 Testing Firebase Admin SDK Connection...');
    console.log('=' * 50);
    
    try {
        // Test 1: Check if adminDb is initialized
        console.log('📋 Test 1: Firebase Admin DB Initialization');
        if (adminDb) {
            console.log('✅ Firebase Admin DB object exists');
        } else {
            console.log('❌ Firebase Admin DB object is null/undefined');
            return false;
        }
        
        // Test 2: Try to get a collection reference
        console.log('\n📋 Test 2: Collection Reference');
        const jobsCollection = adminDb.collection('jobs');
        console.log('✅ Jobs collection reference created');
        
        // Test 3: Try to perform a simple query (this will test authentication)
        console.log('\n📋 Test 3: Authentication Test (Simple Query)');
        
        // Set a timeout for the operation
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timed out after 10 seconds')), 10000);
        });
        
        const queryPromise = jobsCollection.limit(1).get();
        
        try {
            const snapshot = await Promise.race([queryPromise, timeoutPromise]);
            console.log('✅ Firebase authentication successful');
            console.log(`✅ Query returned ${snapshot.size} documents`);
            return true;
        } catch (authError) {
            console.log('❌ Firebase authentication failed:', authError.message);
            
            // Analyze the error
            if (authError.message.includes('Deadline exceeded')) {
                console.log('🔍 Analysis: This is a timeout error');
                console.log('🔍 Likely cause: Missing service account credentials');
                console.log('🔍 Current config only uses projectId without proper authentication');
            } else if (authError.message.includes('UNAUTHENTICATED')) {
                console.log('🔍 Analysis: Authentication error');
                console.log('🔍 Likely cause: Invalid or missing service account key');
            } else if (authError.message.includes('PERMISSION_DENIED')) {
                console.log('🔍 Analysis: Permission denied');
                console.log('🔍 Likely cause: Insufficient permissions or wrong project');
            }
            
            return false;
        }
        
    } catch (error) {
        console.log('❌ Firebase connection test failed:', error.message);
        return false;
    }
}

async function testFirebaseConfiguration() {
    console.log('\n🔧 Testing Firebase Configuration...');
    console.log('=' * 50);
    
    // Check environment variables
    const requiredVars = [
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    ];
    
    let configValid = true;
    for (const varName of requiredVars) {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
        } else {
            console.log(`❌ ${varName}: Not set`);
            configValid = false;
        }
    }
    
    // Check for service account credentials
    const serviceAccountVars = [
        'GOOGLE_APPLICATION_CREDENTIALS',
        'FIREBASE_SERVICE_ACCOUNT_KEY'
    ];
    
    let hasServiceAccount = false;
    for (const varName of serviceAccountVars) {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: Present`);
            hasServiceAccount = true;
        } else {
            console.log(`❌ ${varName}: Not set`);
        }
    }
    
    if (!hasServiceAccount) {
        console.log('⚠️  No service account credentials found');
        console.log('⚠️  This is the likely cause of Firebase authentication issues');
    }
    
    return configValid;
}

async function main() {
    console.log('🚀 Firebase Integration Test for APK Debug Mode Converter');
    console.log('=' * 70);
    
    // Test configuration
    const configOk = await testFirebaseConfiguration();
    
    // Test connection
    const connectionOk = await testFirebaseConnection();
    
    console.log('\n' + '=' * 70);
    console.log('📊 FIREBASE INTEGRATION TEST SUMMARY');
    console.log('=' * 70);
    
    const tests = [
        ['Configuration', configOk],
        ['Connection & Authentication', connectionOk]
    ];
    
    const passed = tests.filter(([_, result]) => result).length;
    const total = tests.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${total - passed}`);
    console.log(`Success Rate: ${((passed/total)*100).toFixed(1)}%`);
    
    console.log('\n📋 DETAILED RESULTS:');
    for (const [testName, result] of tests) {
        const status = result ? '✅' : '❌';
        console.log(`   ${status} ${testName}`);
    }
    
    if (passed < total) {
        console.log('\n🔧 RECOMMENDATIONS:');
        console.log('   - Add Firebase service account credentials');
        console.log('   - Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
        console.log('   - Or modify firebase-admin.js to include service account key');
        console.log('   - Consider using Firebase emulator for development');
    }
    
    // Return success status
    process.exit(connectionOk ? 0 : 1);
}

// Run the test
main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});