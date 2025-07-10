#!/usr/bin/env python3
"""
Firebase Integration Test for APK Debug Mode Converter
Tests the Firebase Admin SDK authentication and Firestore connectivity
"""

import os
import sys
import requests
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv('/app/.env')

# Add the app directory to Python path
sys.path.append('/app')

def test_firebase_admin_import():
    """Test if Firebase Admin SDK can be imported"""
    try:
        from lib.firebase_admin import adminDb
        print("✅ Firebase Admin SDK imported successfully")
        return True
    except Exception as e:
        print(f"❌ Firebase Admin SDK import failed: {e}")
        return False

def test_firebase_connection():
    """Test Firebase connection by attempting a simple operation"""
    try:
        from lib.firebase_admin import adminDb
        
        # Try to get a reference to a collection (this should work even without auth)
        collection_ref = adminDb.collection('test')
        print("✅ Firebase collection reference created")
        
        # Try to perform a simple operation that requires authentication
        try:
            # This will fail if authentication is not properly configured
            docs = list(collection_ref.limit(1).stream())
            print("✅ Firebase authentication working - able to query Firestore")
            return True
        except Exception as auth_error:
            print(f"❌ Firebase authentication failed: {auth_error}")
            
            # Check if it's a timeout or authentication error
            if "Deadline exceeded" in str(auth_error):
                print("   🔍 This appears to be a timeout/connectivity issue")
                print("   🔍 Likely cause: Missing service account credentials")
            elif "UNAUTHENTICATED" in str(auth_error):
                print("   🔍 This is an authentication error")
                print("   🔍 Likely cause: Invalid or missing service account key")
            
            return False
            
    except Exception as e:
        print(f"❌ Firebase connection test failed: {e}")
        return False

def test_environment_variables():
    """Test if required environment variables are set"""
    print("\n🔍 Checking Firebase environment variables:")
    
    firebase_vars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID'
    ]
    
    all_present = True
    for var in firebase_vars:
        value = os.getenv(var)
        if value:
            print(f"   ✅ {var}: {value[:20]}...")
        else:
            print(f"   ❌ {var}: Not set")
            all_present = False
    
    # Check for service account key
    service_account_vars = [
        'FIREBASE_SERVICE_ACCOUNT_KEY',
        'GOOGLE_APPLICATION_CREDENTIALS'
    ]
    
    service_account_present = False
    for var in service_account_vars:
        value = os.getenv(var)
        if value:
            print(f"   ✅ {var}: Present")
            service_account_present = True
        else:
            print(f"   ❌ {var}: Not set")
    
    if not service_account_present:
        print("   ⚠️  No service account credentials found")
        print("   ⚠️  This is likely the cause of Firebase authentication issues")
    
    return all_present

def test_firebase_with_backend_api():
    """Test if we can modify the backend to use Firebase temporarily"""
    print("\n🧪 Testing Firebase integration with backend API...")
    
    # This would require modifying the backend code to use Firebase instead of in-memory storage
    # For now, we'll just check if the Firebase configuration is valid
    
    try:
        # Check if we can initialize Firebase Admin SDK
        from firebase_admin import initialize_app, get_apps, credentials
        from firebase_admin.firestore import client
        
        # Check if already initialized
        if not get_apps():
            # Try to initialize with project ID only (current configuration)
            app = initialize_app(options={
                'projectId': os.getenv('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
            })
            print("✅ Firebase app initialized with project ID")
        else:
            print("✅ Firebase app already initialized")
        
        # Try to get Firestore client
        db = client()
        print("✅ Firestore client created")
        
        # Try a simple operation
        collection_ref = db.collection('jobs')
        print("✅ Jobs collection reference created")
        
        return True
        
    except Exception as e:
        print(f"❌ Firebase backend integration test failed: {e}")
        return False

def main():
    """Run all Firebase integration tests"""
    print("🔥 Firebase Integration Tests for APK Debug Mode Converter")
    print("=" * 70)
    
    # Test environment variables
    env_ok = test_environment_variables()
    
    print("\n" + "=" * 70)
    
    # Test Firebase Admin SDK import
    import_ok = test_firebase_admin_import()
    
    print("\n" + "=" * 70)
    
    # Test Firebase connection
    connection_ok = test_firebase_connection()
    
    print("\n" + "=" * 70)
    
    # Test Firebase with backend API
    backend_ok = test_firebase_with_backend_api()
    
    print("\n" + "=" * 70)
    print("📊 FIREBASE INTEGRATION TEST SUMMARY")
    print("=" * 70)
    
    tests = [
        ("Environment Variables", env_ok),
        ("Firebase Admin Import", import_ok), 
        ("Firebase Connection", connection_ok),
        ("Backend Integration", backend_ok)
    ]
    
    passed = sum(1 for _, result in tests if result)
    total = len(tests)
    
    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    print("\n📋 DETAILED RESULTS:")
    for test_name, result in tests:
        status = "✅" if result else "❌"
        print(f"   {status} {test_name}")
    
    if passed < total:
        print("\n🔧 RECOMMENDATIONS:")
        if not env_ok:
            print("   - Verify all Firebase environment variables are properly set")
        if not connection_ok:
            print("   - Add Firebase service account credentials")
            print("   - Set GOOGLE_APPLICATION_CREDENTIALS environment variable")
            print("   - Or add service account key to Firebase Admin initialization")
        if not backend_ok:
            print("   - Consider using Firebase emulator for development")
            print("   - Or implement proper service account authentication")

if __name__ == "__main__":
    main()