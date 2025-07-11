#!/usr/bin/env python3
"""
Comprehensive Backend Testing for APK Debug Mode Converter
Testing improved APK processing logic for parsing issue fix
"""

import requests
import json
import time
import os
import tempfile
import zipfile
from io import BytesIO
import uuid

# Configuration
BASE_URL = "https://d072a603-2e12-4234-bc2b-04b8f14f4fc2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class APKTestSuite:
    def __init__(self):
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
        
    def log_test(self, test_name, success, message=""):
        """Log test result"""
        self.total_tests += 1
        if success:
            self.passed_tests += 1
            print(f"✅ {test_name}: PASSED {message}")
        else:
            print(f"❌ {test_name}: FAILED {message}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message
        })
    
    def create_test_apk_with_text_manifest(self, filename="test_text_manifest.apk"):
        """Create a test APK with text-based AndroidManifest.xml"""
        print(f"📦 Creating test APK with text manifest: {filename}")
        
        # Create a temporary APK with text manifest
        apk_buffer = BytesIO()
        
        with zipfile.ZipFile(apk_buffer, 'w', zipfile.ZIP_DEFLATED) as apk:
            # Create text-based AndroidManifest.xml
            text_manifest = '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.test.textmanifest"
    android:versionCode="1"
    android:versionName="1.0">
    
    <uses-permission android:name="android.permission.INTERNET" />
    
    <application
        android:allowBackup="true"
        android:label="Test Text App"
        android:theme="@style/AppTheme">
        
        <activity android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
    </application>
</manifest>'''
            
            apk.writestr('AndroidManifest.xml', text_manifest)
            
            # Add basic APK structure
            apk.writestr('classes.dex', b'fake_dex_content')
            apk.writestr('resources.arsc', b'fake_resources')
            
            # Add res directory structure
            apk.writestr('res/values/strings.xml', '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Test Text App</string>
</resources>''')
            
            # Add META-INF for signing
            apk.writestr('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\n')
            apk.writestr('META-INF/CERT.SF', 'Signature-Version: 1.0\n')
            apk.writestr('META-INF/CERT.RSA', b'fake_signature')
        
        apk_buffer.seek(0)
        return apk_buffer.getvalue(), filename
    
    def create_test_apk_with_binary_manifest(self, filename="test_binary_manifest.apk"):
        """Create a test APK with binary AndroidManifest.xml (simulated)"""
        print(f"📦 Creating test APK with binary manifest: {filename}")
        
        apk_buffer = BytesIO()
        
        with zipfile.ZipFile(apk_buffer, 'w', zipfile.ZIP_DEFLATED) as apk:
            # Create binary-like AndroidManifest.xml (not actual binary, but non-text)
            binary_manifest = b'\x03\x00\x08\x00\x1c\x01\x00\x00\x01\x00\x1c\x00\x20\x00\x00\x00'  # Fake binary data
            
            apk.writestr('AndroidManifest.xml', binary_manifest)
            
            # Add basic APK structure
            apk.writestr('classes.dex', b'fake_dex_content_binary')
            apk.writestr('resources.arsc', b'fake_resources_binary')
            
            # Add res directory structure
            apk.writestr('res/values/strings.xml', '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Test Binary App</string>
</resources>''')
            
            # Add META-INF for signing
            apk.writestr('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\n')
            apk.writestr('META-INF/CERT.SF', 'Signature-Version: 1.0\n')
            apk.writestr('META-INF/CERT.RSA', b'fake_signature')
        
        apk_buffer.seek(0)
        return apk_buffer.getvalue(), filename
    
    def create_complex_test_apk(self, filename="test_complex.apk"):
        """Create a more complex test APK with multiple activities and resources"""
        print(f"📦 Creating complex test APK: {filename}")
        
        apk_buffer = BytesIO()
        
        with zipfile.ZipFile(apk_buffer, 'w', zipfile.ZIP_DEFLATED) as apk:
            # Create complex text-based AndroidManifest.xml
            complex_manifest = '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.test.complex"
    android:versionCode="2"
    android:versionName="2.0"
    android:installLocation="auto">
    
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    
    <application
        android:allowBackup="true"
        android:label="Complex Test App"
        android:icon="@drawable/ic_launcher"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true">
        
        <activity android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <activity android:name=".SecondActivity"
            android:exported="false"
            android:parentActivityName=".MainActivity" />
        
        <service android:name=".BackgroundService"
            android:exported="false" />
        
        <receiver android:name=".NotificationReceiver"
            android:exported="false" />
        
    </application>
</manifest>'''
            
            apk.writestr('AndroidManifest.xml', complex_manifest)
            
            # Add more realistic APK structure
            apk.writestr('classes.dex', b'complex_dex_content_' + os.urandom(1024))
            apk.writestr('classes2.dex', b'complex_dex2_content_' + os.urandom(512))
            apk.writestr('resources.arsc', b'complex_resources_' + os.urandom(2048))
            
            # Add multiple resource files
            apk.writestr('res/values/strings.xml', '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Complex Test App</string>
    <string name="activity_main">Main Activity</string>
    <string name="activity_second">Second Activity</string>
</resources>''')
            
            apk.writestr('res/values/colors.xml', '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#FF6200EE</color>
    <color name="primary_dark">#FF3700B3</color>
</resources>''')
            
            apk.writestr('res/layout/activity_main.xml', '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">
    
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/app_name" />
        
</LinearLayout>''')
            
            # Add drawable resources
            apk.writestr('res/drawable/ic_launcher.png', b'fake_png_data')
            
            # Add native libraries
            apk.writestr('lib/arm64-v8a/libnative.so', b'fake_native_lib_arm64')
            apk.writestr('lib/armeabi-v7a/libnative.so', b'fake_native_lib_arm')
            
            # Add assets
            apk.writestr('assets/config.json', '{"version": "2.0", "debug": false}')
            
            # Add META-INF for signing
            apk.writestr('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\n')
            apk.writestr('META-INF/CERT.SF', 'Signature-Version: 1.0\n')
            apk.writestr('META-INF/CERT.RSA', b'fake_signature')
        
        apk_buffer.seek(0)
        return apk_buffer.getvalue(), filename
    
    def test_apk_upload_and_processing(self, apk_data, filename, test_name):
        """Test APK upload and processing with improved logic"""
        print(f"\n🧪 Testing {test_name}")
        
        try:
            # Test APK upload
            files = {'apk': (filename, apk_data, 'application/vnd.android.package-archive')}
            
            print(f"📤 Uploading {filename} ({len(apk_data)} bytes)")
            response = requests.post(f"{API_BASE}/convert", files=files, timeout=30)
            
            if response.status_code != 200:
                self.log_test(f"{test_name} - Upload", False, f"Upload failed: {response.status_code} - {response.text}")
                return None
            
            job_data = response.json()
            job_id = job_data.get('jobId')
            
            if not job_id:
                self.log_test(f"{test_name} - Upload", False, "No job ID returned")
                return None
            
            self.log_test(f"{test_name} - Upload", True, f"Job created: {job_id}")
            
            # Monitor processing
            print(f"⏳ Monitoring job progress...")
            max_wait_time = 120  # 2 minutes
            start_time = time.time()
            
            while time.time() - start_time < max_wait_time:
                status_response = requests.get(f"{API_BASE}/status/{job_id}", timeout=10)
                
                if status_response.status_code != 200:
                    self.log_test(f"{test_name} - Status Check", False, f"Status check failed: {status_response.status_code}")
                    return None
                
                status_data = status_response.json()
                progress = status_data.get('progress', 0)
                current_step = status_data.get('currentStep', 'Unknown')
                status = status_data.get('status', 'unknown')
                logs = status_data.get('logs', [])
                
                print(f"📊 Progress: {progress}% - {current_step}")
                
                if status == 'completed':
                    result = status_data.get('result', {})
                    self.log_test(f"{test_name} - Processing", True, f"Completed successfully: {result.get('fileName', 'unknown')}")
                    
                    # Test the processing logs for improved features
                    self.analyze_processing_logs(logs, test_name)
                    
                    # Test download
                    if result.get('fileName'):
                        self.test_debug_apk_download(result['fileName'], test_name)
                    
                    return result
                
                elif status == 'error':
                    error_msg = status_data.get('error', 'Unknown error')
                    self.log_test(f"{test_name} - Processing", False, f"Processing failed: {error_msg}")
                    return None
                
                time.sleep(2)
            
            self.log_test(f"{test_name} - Processing", False, "Processing timeout")
            return None
            
        except Exception as e:
            self.log_test(f"{test_name} - Exception", False, f"Exception: {str(e)}")
            return None
    
    def analyze_processing_logs(self, logs, test_name):
        """Analyze processing logs for improved APK processing features"""
        print(f"🔍 Analyzing processing logs for {test_name}")
        
        # Check for improved manifest handling
        manifest_analysis = False
        debug_features = False
        structure_preservation = False
        network_config = False
        strings_creation = False
        
        for log in logs:
            log_msg = log.lower()
            
            if 'analyzing original androidmanifest.xml' in log_msg:
                manifest_analysis = True
            
            if 'found text-based androidmanifest.xml' in log_msg or 'found binary androidmanifest.xml' in log_msg:
                structure_preservation = True
            
            if 'enhancing existing text manifest' in log_msg or 'creating minimal debug manifest' in log_msg:
                debug_features = True
            
            if 'creating network security configuration' in log_msg:
                network_config = True
            
            if 'adding debug resources' in log_msg:
                strings_creation = True
        
        # Log analysis results
        self.log_test(f"{test_name} - Manifest Analysis", manifest_analysis, "Original manifest analyzed")
        self.log_test(f"{test_name} - Structure Preservation", structure_preservation, "Original structure detected and preserved")
        self.log_test(f"{test_name} - Debug Features", debug_features, "Debug features properly injected")
        self.log_test(f"{test_name} - Network Config", network_config, "Network security config created")
        self.log_test(f"{test_name} - Resource Creation", strings_creation, "Debug resources and strings.xml created")
    
    def test_debug_apk_download(self, filename, test_name):
        """Test downloading and validating the debug APK"""
        print(f"📥 Testing debug APK download: {filename}")
        
        try:
            download_response = requests.get(f"{API_BASE}/download/{filename}", timeout=30)
            
            if download_response.status_code != 200:
                self.log_test(f"{test_name} - Download", False, f"Download failed: {download_response.status_code}")
                return
            
            # Validate APK structure
            apk_data = download_response.content
            self.log_test(f"{test_name} - Download", True, f"Downloaded {len(apk_data)} bytes")
            
            # Validate APK structure
            self.validate_debug_apk_structure(apk_data, test_name)
            
        except Exception as e:
            self.log_test(f"{test_name} - Download Exception", False, f"Exception: {str(e)}")
    
    def validate_debug_apk_structure(self, apk_data, test_name):
        """Validate the structure of the generated debug APK"""
        print(f"🔍 Validating debug APK structure for {test_name}")
        
        try:
            apk_buffer = BytesIO(apk_data)
            
            with zipfile.ZipFile(apk_buffer, 'r') as apk:
                file_list = apk.namelist()
                
                # Check for required files
                required_files = [
                    'AndroidManifest.xml',
                    'res/xml/network_security_config.xml',
                    'res/values/strings.xml'
                ]
                
                missing_files = []
                for required_file in required_files:
                    if required_file not in file_list:
                        missing_files.append(required_file)
                
                if missing_files:
                    self.log_test(f"{test_name} - APK Structure", False, f"Missing files: {missing_files}")
                else:
                    self.log_test(f"{test_name} - APK Structure", True, "All required debug files present")
                
                # Check AndroidManifest.xml content
                try:
                    manifest_content = apk.read('AndroidManifest.xml')
                    
                    # Try to read as text (for text manifests)
                    try:
                        manifest_text = manifest_content.decode('utf-8')
                        
                        # Check for debug attributes
                        debug_features = [
                            'android:debuggable="true"',
                            'android:usesCleartextTraffic="true"',
                            'android:networkSecurityConfig="@xml/network_security_config"'
                        ]
                        
                        found_features = []
                        for feature in debug_features:
                            if feature in manifest_text:
                                found_features.append(feature)
                        
                        if len(found_features) >= 2:  # At least 2 debug features should be present
                            self.log_test(f"{test_name} - Debug Features", True, f"Found debug features: {len(found_features)}")
                        else:
                            self.log_test(f"{test_name} - Debug Features", False, f"Insufficient debug features: {found_features}")
                    
                    except UnicodeDecodeError:
                        # Binary manifest - check if it was handled properly
                        self.log_test(f"{test_name} - Binary Manifest Handling", True, "Binary manifest processed (cannot validate content)")
                
                except Exception as e:
                    self.log_test(f"{test_name} - Manifest Validation", False, f"Manifest validation error: {str(e)}")
                
                # Check network security config
                try:
                    network_config = apk.read('res/xml/network_security_config.xml').decode('utf-8')
                    
                    if 'cleartextTrafficPermitted="true"' in network_config and 'debug-overrides' in network_config:
                        self.log_test(f"{test_name} - Network Security Config", True, "Network security config properly configured")
                    else:
                        self.log_test(f"{test_name} - Network Security Config", False, "Network security config missing debug features")
                
                except Exception as e:
                    self.log_test(f"{test_name} - Network Security Config", False, f"Network config error: {str(e)}")
                
                # Check strings.xml
                try:
                    strings_content = apk.read('res/values/strings.xml').decode('utf-8')
                    
                    if 'app_name' in strings_content and 'debug_mode_enabled' in strings_content:
                        self.log_test(f"{test_name} - Strings Resources", True, "Strings.xml properly created with debug resources")
                    else:
                        self.log_test(f"{test_name} - Strings Resources", False, "Strings.xml missing required entries")
                
                except Exception as e:
                    self.log_test(f"{test_name} - Strings Resources", False, f"Strings validation error: {str(e)}")
        
        except Exception as e:
            self.log_test(f"{test_name} - APK Validation Exception", False, f"Exception: {str(e)}")
    
    def test_api_endpoints(self):
        """Test basic API endpoints"""
        print("\n🔧 Testing API Endpoints")
        
        # Test MongoDB connection
        try:
            response = requests.get(f"{API_BASE}/test-mongodb", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_test("MongoDB Connection", data.get('success', False), data.get('message', ''))
            else:
                self.log_test("MongoDB Connection", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("MongoDB Connection", False, f"Exception: {str(e)}")
        
        # Test stats endpoint
        try:
            response = requests.get(f"{API_BASE}/stats", timeout=10)
            if response.status_code == 200:
                stats = response.json()
                self.log_test("Stats Endpoint", True, f"Total jobs: {stats.get('total', 0)}, Storage: {stats.get('storage', 'unknown')}")
            else:
                self.log_test("Stats Endpoint", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("Stats Endpoint", False, f"Exception: {str(e)}")
    
    def run_comprehensive_tests(self):
        """Run comprehensive APK processing tests"""
        print("🚀 Starting Comprehensive APK Processing Tests")
        print("=" * 60)
        
        # Test API endpoints first
        self.test_api_endpoints()
        
        # Test 1: Text-based AndroidManifest.xml
        apk_data, filename = self.create_test_apk_with_text_manifest()
        self.test_apk_upload_and_processing(apk_data, filename, "Text Manifest APK")
        
        # Test 2: Binary AndroidManifest.xml (simulated)
        apk_data, filename = self.create_test_apk_with_binary_manifest()
        self.test_apk_upload_and_processing(apk_data, filename, "Binary Manifest APK")
        
        # Test 3: Complex APK with multiple components
        apk_data, filename = self.create_complex_test_apk()
        self.test_apk_upload_and_processing(apk_data, filename, "Complex APK")
        
        # Test error handling
        self.test_error_handling()
        
        # Print final results
        self.print_final_results()
    
    def test_error_handling(self):
        """Test error handling scenarios"""
        print("\n🚨 Testing Error Handling")
        
        # Test invalid file upload
        try:
            files = {'apk': ('test.txt', b'not an apk file', 'text/plain')}
            response = requests.post(f"{API_BASE}/convert", files=files, timeout=10)
            
            if response.status_code == 400:
                self.log_test("Invalid File Type", True, "Correctly rejected non-APK file")
            else:
                self.log_test("Invalid File Type", False, f"Unexpected response: {response.status_code}")
        except Exception as e:
            self.log_test("Invalid File Type", False, f"Exception: {str(e)}")
        
        # Test file too large (simulate)
        try:
            large_data = b'x' * (101 * 1024 * 1024)  # 101MB
            files = {'apk': ('large.apk', large_data, 'application/vnd.android.package-archive')}
            response = requests.post(f"{API_BASE}/convert", files=files, timeout=10)
            
            if response.status_code == 400:
                self.log_test("File Size Limit", True, "Correctly rejected oversized file")
            else:
                self.log_test("File Size Limit", False, f"Unexpected response: {response.status_code}")
        except Exception as e:
            self.log_test("File Size Limit", False, f"Exception: {str(e)}")
        
        # Test invalid job ID
        try:
            fake_job_id = str(uuid.uuid4())
            response = requests.get(f"{API_BASE}/status/{fake_job_id}", timeout=10)
            
            if response.status_code == 404:
                self.log_test("Invalid Job ID", True, "Correctly returned 404 for invalid job ID")
            else:
                self.log_test("Invalid Job ID", False, f"Unexpected response: {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Job ID", False, f"Exception: {str(e)}")
    
    def print_final_results(self):
        """Print comprehensive test results"""
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE TEST RESULTS")
        print("=" * 60)
        
        success_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.total_tests - self.passed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        print("\n📋 DETAILED RESULTS:")
        print("-" * 60)
        
        for result in self.test_results:
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            message = f" - {result['message']}" if result['message'] else ""
            print(f"{status}: {result['test']}{message}")
        
        print("\n" + "=" * 60)
        
        if success_rate >= 90:
            print("🎉 EXCELLENT: APK processing system is working excellently!")
        elif success_rate >= 75:
            print("✅ GOOD: APK processing system is working well with minor issues.")
        elif success_rate >= 50:
            print("⚠️  MODERATE: APK processing system has some issues that need attention.")
        else:
            print("❌ CRITICAL: APK processing system has significant issues.")
        
        print("=" * 60)

if __name__ == "__main__":
    print("🧪 APK Debug Mode Converter - Comprehensive Backend Testing")
    print("Testing improved APK processing logic for parsing issue fix")
    print("=" * 60)
    
    test_suite = APKTestSuite()
    test_suite.run_comprehensive_tests()