#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for APK Debug Mode Converter
Tests all three main endpoints: /api/convert, /api/status/{jobId}, /api/download/{fileName}
"""

import requests
import json
import time
import os
import tempfile
import zipfile
from io import BytesIO

# Get base URL from environment or use default
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://8af61f18-fcad-4c8e-b358-c33950370964.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

class APKDebugConverterTester:
    def __init__(self):
        self.base_url = API_BASE
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
    
    def create_mock_apk(self, filename="test.apk", size_mb=1):
        """Create a mock APK file for testing"""
        try:
            # Create a temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.apk')
            
            # Create a ZIP file (APK is essentially a ZIP)
            with zipfile.ZipFile(temp_file.name, 'w') as zip_file:
                # Add AndroidManifest.xml (required for valid APK)
                manifest_content = '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.test.app">
    <application android:label="Test App">
        <activity android:name=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>'''
                zip_file.writestr('AndroidManifest.xml', manifest_content)
                
                # Add some dummy files to reach desired size
                dummy_content = b'0' * (1024 * 1024)  # 1MB chunks
                for i in range(size_mb):
                    zip_file.writestr(f'dummy_{i}.dat', dummy_content)
            
            return temp_file.name
        except Exception as e:
            print(f"Error creating mock APK: {e}")
            return None
    
    def create_invalid_file(self, filename="test.txt"):
        """Create an invalid file (not APK) for testing"""
        try:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.txt')
            temp_file.write(b"This is not an APK file")
            temp_file.close()
            return temp_file.name
        except Exception as e:
            print(f"Error creating invalid file: {e}")
            return None
    
    def test_convert_endpoint_valid_apk(self):
        """Test POST /api/convert with valid APK file"""
        print("\n=== Testing POST /api/convert with valid APK ===")
        
        apk_path = self.create_mock_apk("valid_test.apk", 1)
        if not apk_path:
            self.log_result("Convert Valid APK", False, "Failed to create mock APK file")
            return None
        
        try:
            with open(apk_path, 'rb') as f:
                files = {'apk': ('test.apk', f, 'application/vnd.android.package-archive')}
                response = requests.post(f"{self.base_url}/convert", files=files, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if 'jobId' in data:
                    self.log_result("Convert Valid APK", True, f"Job created successfully with ID: {data['jobId']}", 
                                  {'jobId': data['jobId'], 'status_code': response.status_code})
                    return data['jobId']
                else:
                    self.log_result("Convert Valid APK", False, "Response missing jobId", 
                                  {'response': data, 'status_code': response.status_code})
            else:
                self.log_result("Convert Valid APK", False, f"HTTP {response.status_code}", 
                              {'response': response.text, 'status_code': response.status_code})
        
        except Exception as e:
            self.log_result("Convert Valid APK", False, f"Request failed: {str(e)}")
        
        finally:
            # Cleanup
            if os.path.exists(apk_path):
                os.unlink(apk_path)
        
        return None
    
    def test_convert_endpoint_invalid_file(self):
        """Test POST /api/convert with invalid file type"""
        print("\n=== Testing POST /api/convert with invalid file ===")
        
        invalid_path = self.create_invalid_file("invalid.txt")
        if not invalid_path:
            self.log_result("Convert Invalid File", False, "Failed to create invalid file")
            return
        
        try:
            with open(invalid_path, 'rb') as f:
                files = {'apk': ('test.txt', f, 'text/plain')}
                response = requests.post(f"{self.base_url}/convert", files=files, timeout=30)
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'Invalid file type' in data['error']:
                    self.log_result("Convert Invalid File", True, "Correctly rejected invalid file type", 
                                  {'error': data['error'], 'status_code': response.status_code})
                else:
                    self.log_result("Convert Invalid File", False, "Wrong error message", 
                                  {'response': data, 'status_code': response.status_code})
            else:
                self.log_result("Convert Invalid File", False, f"Expected 400, got {response.status_code}", 
                              {'response': response.text, 'status_code': response.status_code})
        
        except Exception as e:
            self.log_result("Convert Invalid File", False, f"Request failed: {str(e)}")
        
        finally:
            # Cleanup
            if os.path.exists(invalid_path):
                os.unlink(invalid_path)
    
    def test_convert_endpoint_large_file(self):
        """Test POST /api/convert with file exceeding size limit"""
        print("\n=== Testing POST /api/convert with large file ===")
        
        # Create a 101MB APK (exceeds 100MB limit)
        large_apk_path = self.create_mock_apk("large_test.apk", 101)
        if not large_apk_path:
            self.log_result("Convert Large File", False, "Failed to create large APK file")
            return
        
        try:
            with open(large_apk_path, 'rb') as f:
                files = {'apk': ('large_test.apk', f, 'application/vnd.android.package-archive')}
                response = requests.post(f"{self.base_url}/convert", files=files, timeout=60)
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'too large' in data['error'].lower():
                    self.log_result("Convert Large File", True, "Correctly rejected large file", 
                                  {'error': data['error'], 'status_code': response.status_code})
                else:
                    self.log_result("Convert Large File", False, "Wrong error message", 
                                  {'response': data, 'status_code': response.status_code})
            else:
                self.log_result("Convert Large File", False, f"Expected 400, got {response.status_code}", 
                              {'response': response.text, 'status_code': response.status_code})
        
        except Exception as e:
            self.log_result("Convert Large File", False, f"Request failed: {str(e)}")
        
        finally:
            # Cleanup
            if os.path.exists(large_apk_path):
                os.unlink(large_apk_path)
    
    def test_convert_endpoint_no_file(self):
        """Test POST /api/convert without file"""
        print("\n=== Testing POST /api/convert without file ===")
        
        try:
            response = requests.post(f"{self.base_url}/convert", data={}, timeout=30)
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'No APK file provided' in data['error']:
                    self.log_result("Convert No File", True, "Correctly rejected request without file", 
                                  {'error': data['error'], 'status_code': response.status_code})
                else:
                    self.log_result("Convert No File", False, "Wrong error message", 
                                  {'response': data, 'status_code': response.status_code})
            else:
                self.log_result("Convert No File", False, f"Expected 400, got {response.status_code}", 
                              {'response': response.text, 'status_code': response.status_code})
        
        except Exception as e:
            self.log_result("Convert No File", False, f"Request failed: {str(e)}")
    
    def test_status_endpoint(self, job_id):
        """Test GET /api/status/{jobId}"""
        print(f"\n=== Testing GET /api/status/{job_id} ===")
        
        if not job_id:
            self.log_result("Status Endpoint", False, "No job ID provided for testing")
            return
        
        try:
            response = requests.get(f"{self.base_url}/status/{job_id}", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['status', 'progress', 'currentStep', 'logs']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("Status Endpoint", True, f"Status retrieved successfully", 
                                  {'status': data['status'], 'progress': data['progress'], 
                                   'currentStep': data['currentStep'], 'logs_count': len(data['logs'])})
                    
                    # Monitor progress for a few iterations
                    self.monitor_job_progress(job_id)
                else:
                    self.log_result("Status Endpoint", False, f"Missing required fields: {missing_fields}", 
                                  {'response': data, 'status_code': response.status_code})
            else:
                self.log_result("Status Endpoint", False, f"HTTP {response.status_code}", 
                              {'response': response.text, 'status_code': response.status_code})
        
        except Exception as e:
            self.log_result("Status Endpoint", False, f"Request failed: {str(e)}")
    
    def test_status_endpoint_invalid_job(self):
        """Test GET /api/status/{jobId} with invalid job ID"""
        print("\n=== Testing GET /api/status with invalid job ID ===")
        
        invalid_job_id = "invalid-job-id-12345"
        
        try:
            response = requests.get(f"{self.base_url}/status/{invalid_job_id}", timeout=30)
            
            if response.status_code == 404:
                data = response.json()
                if 'error' in data and 'Job not found' in data['error']:
                    self.log_result("Status Invalid Job", True, "Correctly returned 404 for invalid job ID", 
                                  {'error': data['error'], 'status_code': response.status_code})
                else:
                    self.log_result("Status Invalid Job", False, "Wrong error message", 
                                  {'response': data, 'status_code': response.status_code})
            else:
                self.log_result("Status Invalid Job", False, f"Expected 404, got {response.status_code}", 
                              {'response': response.text, 'status_code': response.status_code})
        
        except Exception as e:
            self.log_result("Status Invalid Job", False, f"Request failed: {str(e)}")
    
    def monitor_job_progress(self, job_id, max_iterations=10):
        """Monitor job progress for testing"""
        print(f"\n=== Monitoring job progress for {job_id} ===")
        
        for i in range(max_iterations):
            try:
                response = requests.get(f"{self.base_url}/status/{job_id}", timeout=30)
                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status', 'unknown')
                    progress = data.get('progress', 0)
                    current_step = data.get('currentStep', 'Unknown')
                    
                    print(f"   Iteration {i+1}: Status={status}, Progress={progress}%, Step={current_step}")
                    
                    if status == 'completed':
                        self.log_result("Job Processing", True, f"Job completed successfully after {i+1} checks", 
                                      {'final_status': status, 'progress': progress, 'result': data.get('result')})
                        return data.get('result')
                    elif status == 'error':
                        self.log_result("Job Processing", False, f"Job failed with error", 
                                      {'error': data.get('error'), 'logs': data.get('logs', [])})
                        return None
                    
                    time.sleep(2)  # Wait 2 seconds between checks
                else:
                    print(f"   Error checking status: HTTP {response.status_code}")
                    break
            except Exception as e:
                print(f"   Error monitoring progress: {e}")
                break
        
        # If we reach here, job didn't complete in time
        self.log_result("Job Processing", False, f"Job did not complete within {max_iterations} checks")
        return None
    
    def test_download_endpoint(self, result_data):
        """Test GET /api/download/{fileName}"""
        print("\n=== Testing GET /api/download/{fileName} ===")
        
        if not result_data or 'fileName' not in result_data:
            self.log_result("Download Endpoint", False, "No result data or fileName provided")
            return
        
        file_name = result_data['fileName']
        
        try:
            response = requests.get(f"{self.base_url}/download/{file_name}", timeout=60)
            
            if response.status_code == 200:
                # Check headers
                content_type = response.headers.get('Content-Type', '')
                content_disposition = response.headers.get('Content-Disposition', '')
                content_length = response.headers.get('Content-Length', '0')
                
                if 'application/vnd.android.package-archive' in content_type:
                    self.log_result("Download Endpoint", True, f"File downloaded successfully", 
                                  {'file_name': file_name, 'size': content_length, 
                                   'content_type': content_type, 'disposition': content_disposition})
                else:
                    self.log_result("Download Endpoint", False, f"Wrong content type: {content_type}", 
                                  {'file_name': file_name, 'headers': dict(response.headers)})
            else:
                self.log_result("Download Endpoint", False, f"HTTP {response.status_code}", 
                              {'response': response.text, 'status_code': response.status_code})
        
        except Exception as e:
            self.log_result("Download Endpoint", False, f"Request failed: {str(e)}")
    
    def test_download_endpoint_invalid_file(self):
        """Test GET /api/download/{fileName} with invalid file name"""
        print("\n=== Testing GET /api/download with invalid file name ===")
        
        invalid_file_name = "nonexistent-file.apk"
        
        try:
            response = requests.get(f"{self.base_url}/download/{invalid_file_name}", timeout=30)
            
            if response.status_code == 404:
                data = response.json()
                if 'error' in data and 'File not found' in data['error']:
                    self.log_result("Download Invalid File", True, "Correctly returned 404 for invalid file", 
                                  {'error': data['error'], 'status_code': response.status_code})
                else:
                    self.log_result("Download Invalid File", False, "Wrong error message", 
                                  {'response': data, 'status_code': response.status_code})
            else:
                self.log_result("Download Invalid File", False, f"Expected 404, got {response.status_code}", 
                              {'response': response.text, 'status_code': response.status_code})
        
        except Exception as e:
            self.log_result("Download Invalid File", False, f"Request failed: {str(e)}")
    
    def test_invalid_endpoints(self):
        """Test invalid API endpoints"""
        print("\n=== Testing invalid endpoints ===")
        
        invalid_endpoints = [
            "/api/invalid",
            "/api/convert/extra",
            "/api/status",  # Missing job ID
            "/api/download"  # Missing file name
        ]
        
        for endpoint in invalid_endpoints:
            try:
                response = requests.get(f"{BASE_URL}{endpoint}", timeout=30)
                if response.status_code in [400, 404]:
                    self.log_result(f"Invalid Endpoint {endpoint}", True, f"Correctly returned {response.status_code}")
                else:
                    self.log_result(f"Invalid Endpoint {endpoint}", False, f"Expected 400/404, got {response.status_code}")
            except Exception as e:
                self.log_result(f"Invalid Endpoint {endpoint}", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting APK Debug Mode Converter Backend API Tests")
        print(f"📍 Testing API at: {self.base_url}")
        print("=" * 80)
        
        # Test convert endpoint with various scenarios
        job_id = self.test_convert_endpoint_valid_apk()
        self.test_convert_endpoint_invalid_file()
        self.test_convert_endpoint_large_file()
        self.test_convert_endpoint_no_file()
        
        # Test status endpoint
        self.test_status_endpoint(job_id)
        self.test_status_endpoint_invalid_job()
        
        # Test download endpoint (if we have a completed job)
        if job_id:
            # Wait a bit more for processing to complete
            time.sleep(5)
            try:
                response = requests.get(f"{self.base_url}/status/{job_id}", timeout=30)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('status') == 'completed' and data.get('result'):
                        self.test_download_endpoint(data['result'])
            except:
                pass
        
        self.test_download_endpoint_invalid_file()
        
        # Test invalid endpoints
        self.test_invalid_endpoints()
        
        # Print summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 80)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   ❌ {result['test']}: {result['message']}")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"   {status} {result['test']}: {result['message']}")
        
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = APKDebugConverterTester()
    tester.run_all_tests()