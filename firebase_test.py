#!/usr/bin/env python3
"""
Simple Firebase Connection Test
"""

import requests
import json

BASE_URL = "https://d072a603-2e12-4234-bc2b-04b8f14f4fc2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_firebase_connection():
    """Test Firebase connection by trying to access status endpoint"""
    print("🔥 Testing Firebase Connection...")
    
    try:
        print("   Making request to status endpoint with invalid job ID...")
        response = requests.get(f"{API_BASE}/status/test-firebase-connection", timeout=10)
        
        print(f"   Response status: {response.status_code}")
        print(f"   Response time: {response.elapsed.total_seconds():.2f}s")
        
        if response.status_code == 404:
            print("✅ Firebase connection working - got expected 404 for non-existent job")
            try:
                data = response.json()
                print(f"   Response data: {data}")
            except:
                print(f"   Raw response: {response.text}")
            return True
        elif response.status_code == 500:
            print("❌ Firebase connection failed - got 500 error")
            try:
                error_data = response.json()
                print(f"   Error details: {error_data}")
            except:
                print(f"   Raw response: {response.text}")
            return False
        else:
            print(f"⚠️  Unexpected response code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out - Firebase connection likely hanging")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error testing Firebase: {e}")
        return False

def test_simple_post():
    """Test simple POST request without file"""
    print("\n📤 Testing simple POST request...")
    
    try:
        print("   Making POST request without file...")
        response = requests.post(f"{API_BASE}/convert", timeout=10)
        
        print(f"   Response status: {response.status_code}")
        print(f"   Response time: {response.elapsed.total_seconds():.2f}s")
        
        if response.status_code == 400:
            print("✅ POST endpoint responding correctly")
            try:
                data = response.json()
                print(f"   Response data: {data}")
            except:
                print(f"   Raw response: {response.text}")
            return True
        else:
            print(f"⚠️  Unexpected response code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ POST request timed out - likely Firebase issue")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error testing POST: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Firebase Connection Diagnostic Test")
    print(f"   Base URL: {BASE_URL}")
    print(f"   API Base: {API_BASE}")
    print("=" * 60)
    
    firebase_ok = test_firebase_connection()
    post_ok = test_simple_post()
    
    print("\n" + "=" * 60)
    print("📊 DIAGNOSTIC RESULTS")
    print("=" * 60)
    
    if firebase_ok and post_ok:
        print("✅ Firebase integration appears to be working")
    elif not firebase_ok:
        print("❌ Firebase connection issue detected")
        print("   This is likely causing the 500 errors and timeouts")
    elif not post_ok:
        print("❌ POST endpoint issue detected")
    else:
        print("⚠️  Mixed results - need further investigation")