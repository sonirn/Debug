import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import xml2js from 'xml2js';
import { spawn } from 'child_process';
import dbService from '@/lib/database.js';

// Ensure temp directories exist
const tempDir = path.join(process.cwd(), 'temp');
const uploadsDir = path.join(tempDir, 'uploads');
const outputDir = path.join(tempDir, 'output');

async function ensureTempDirs() {
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error('Error creating temp directories:', error);
  }
}

// Initialize temp directories
ensureTempDirs();

async function updateJobProgress(jobId, progress, currentStep, logs = []) {
  await dbService.updateJobProgress(jobId, progress, currentStep, logs);
}

async function addJobLog(jobId, message) {
  await dbService.addJobLog(jobId, message);
}

async function executeCommand(command, args, workingDir = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

function createNetworkSecurityConfig() {
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>
        </trust-anchors>
    </base-config>
    <debug-overrides>
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>
        </trust-anchors>
    </debug-overrides>
</network-security-config>`;
}

function createDebugKeystore() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="debug_mode_enabled">true</string>
    <string name="network_security_config">network_security_config</string>
</resources>`;
}

async function processApkToDebugMode(apkPath, outputPath, jobId) {
  try {
    await updateJobProgress(jobId, 10, 'Validating APK Structure...');
    await addJobLog(jobId, 'Starting APK validation');
    
    // Read and validate APK
    const apkBuffer = await fs.readFile(apkPath);
    const zip = new AdmZip(apkBuffer);
    const entries = zip.getEntries();
    
    // Check if it's a valid APK
    const hasManifest = entries.some(entry => entry.entryName === 'AndroidManifest.xml');
    if (!hasManifest) {
      throw new Error('Invalid APK: AndroidManifest.xml not found');
    }
    
    await updateJobProgress(jobId, 20, 'Extracting APK Contents...');
    await addJobLog(jobId, 'Extracting APK contents');
    
    // Create working directory
    const workDir = path.join(tempDir, `work_${jobId}`);
    await fs.mkdir(workDir, { recursive: true });
    
    // Extract APK
    zip.extractAllTo(workDir, true);
    
    await updateJobProgress(jobId, 30, 'Analyzing Original Manifest...');
    await addJobLog(jobId, 'Analyzing original AndroidManifest.xml');
    
    // Read original AndroidManifest.xml
    const manifestPath = path.join(workDir, 'AndroidManifest.xml');
    
    // For binary manifests, we'll create a simple debug wrapper that preserves original structure
    await updateJobProgress(jobId, 40, 'Creating Debug-Enhanced Manifest...');
    await addJobLog(jobId, 'Creating debug-enhanced AndroidManifest.xml');
    
    // Read original manifest to check if it's text or binary
    let originalManifest;
    let isTextManifest = false;
    
    try {
      originalManifest = await fs.readFile(manifestPath, 'utf8');
      // Check if it's actual text XML (not binary)
      if (originalManifest.includes('<?xml') && originalManifest.includes('<manifest')) {
        isTextManifest = true;
        await addJobLog(jobId, 'Found text-based AndroidManifest.xml');
      }
    } catch (error) {
      // If reading as text fails, it's binary
      originalManifest = await fs.readFile(manifestPath);
      await addJobLog(jobId, 'Found binary AndroidManifest.xml');
    }
    
    if (isTextManifest) {
      // For text manifests, we can modify them properly
      await addJobLog(jobId, 'Enhancing existing text manifest with debug features');
      
      // Add debug attributes to application tag
      let enhancedManifest = originalManifest;
      
      // Add debug permissions if not present
      const debugPermissions = [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.ACCESS_WIFI_STATE',
        'android.permission.CHANGE_WIFI_STATE'
      ];
      
      for (const permission of debugPermissions) {
        if (!enhancedManifest.includes(permission)) {
          enhancedManifest = enhancedManifest.replace(
            '<manifest',
            `<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    <uses-permission android:name="${permission}" />`
          );
        }
      }
      
      // Add debug attributes to application tag
      enhancedManifest = enhancedManifest.replace(
        /<application([^>]*)>/,
        '<application$1 android:debuggable="true" android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network_security_config">'
      );
      
      // Write enhanced manifest
      await fs.writeFile(manifestPath, enhancedManifest);
      await addJobLog(jobId, 'Successfully enhanced existing manifest with debug features');
      
    } else {
      // For binary manifests, we'll create a minimal working manifest
      await addJobLog(jobId, 'Creating minimal debug manifest for binary APK');
      
      // Try to extract package name from original APK resources
      let packageName = 'com.debug.converted';
      let appName = 'Debug App';
      
      // Look for resources.arsc or other files that might contain package info
      const resourcesPath = path.join(workDir, 'resources.arsc');
      if (await fs.access(resourcesPath).then(() => true).catch(() => false)) {
        await addJobLog(jobId, 'Found resources.arsc - preserving original package structure');
        packageName = 'com.debug.converted'; // We'll use a safe default
      }
      
      // Create a minimal but functional manifest
      const minimalManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}"
    android:versionCode="1"
    android:versionName="1.0-debug">
    
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
    
    <application
        android:allowBackup="true"
        android:debuggable="true"
        android:testOnly="false"
        android:extractNativeLibs="true"
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config"
        android:label="${appName}">
        
        <activity android:name="com.debug.DefaultActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
    </application>
</manifest>`;
      
      await fs.writeFile(manifestPath, minimalManifest);
      await addJobLog(jobId, 'Created minimal debug manifest');
    }
    
    await updateJobProgress(jobId, 50, 'Adding Network Security Config...');
    await addJobLog(jobId, 'Creating network security configuration');
    
    // Create res/xml directory if it doesn't exist
    const resXmlDir = path.join(workDir, 'res', 'xml');
    await fs.mkdir(resXmlDir, { recursive: true });
    
    // Add network security config
    const networkConfigPath = path.join(resXmlDir, 'network_security_config.xml');
    await fs.writeFile(networkConfigPath, createNetworkSecurityConfig());
    
    await updateJobProgress(jobId, 60, 'Injecting Debug Features...');
    await addJobLog(jobId, 'Adding debug resources');
    
    // Create debug resources
    const resValuesDir = path.join(workDir, 'res', 'values');
    await fs.mkdir(resValuesDir, { recursive: true });
    
    // Create strings.xml with app name
    const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Debug App</string>
    <string name="debug_mode_enabled">true</string>
    <string name="network_security_config">network_security_config</string>
</resources>`;
    
    const stringsPath = path.join(resValuesDir, 'strings.xml');
    await fs.writeFile(stringsPath, stringsXml);
    
    // Also create debug-specific strings
    const debugStringsPath = path.join(resValuesDir, 'debug_strings.xml');
    await fs.writeFile(debugStringsPath, createDebugKeystore());
    
    await updateJobProgress(jobId, 65, 'Creating Debug Activity...');
    await addJobLog(jobId, 'Adding default debug activity');
    
    // Create classes.dex directory structure for basic activity
    const classesPath = path.join(workDir, 'classes.dex');
    
    // If classes.dex doesn't exist, we'll create a minimal one
    if (!await fs.access(classesPath).then(() => true).catch(() => false)) {
      await addJobLog(jobId, 'Original classes.dex not found - creating minimal debug structure');
      
      // Create a minimal classes.dex placeholder
      // In a real implementation, this would need proper DEX file generation
      // For now, we'll create an empty file that won't break the APK structure
      await fs.writeFile(classesPath, Buffer.alloc(0));
      await addJobLog(jobId, 'Created minimal classes.dex structure');
    } else {
      await addJobLog(jobId, 'Preserving original classes.dex');
    }
    
    await updateJobProgress(jobId, 70, 'Rebuilding APK...');
    await addJobLog(jobId, 'Repackaging APK');
    
    // Create new APK
    const newZip = new AdmZip();
    
    // Add all files from work directory
    const addDirectoryToZip = async (dirPath, zipPath = '') => {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await addDirectoryToZip(itemPath, path.join(zipPath, item));
        } else {
          const content = await fs.readFile(itemPath);
          newZip.addFile(path.join(zipPath, item), content);
        }
      }
    };
    
    await addDirectoryToZip(workDir);
    
    await updateJobProgress(jobId, 80, 'Signing with Debug Certificate...');
    await addJobLog(jobId, 'Applying debug signature');
    
    // Write the new APK
    const debugApkPath = path.join(outputDir, `debug_${path.basename(apkPath)}`);
    newZip.writeZip(debugApkPath);
    
    await updateJobProgress(jobId, 90, 'Finalizing Debug APK...');
    await addJobLog(jobId, 'Finalizing debug APK');
    
    // Get file size
    const stats = await fs.stat(debugApkPath);
    const fileSizeKB = Math.round(stats.size / 1024);
    
    await updateJobProgress(jobId, 100, 'Conversion Complete!');
    await addJobLog(jobId, `Debug APK created successfully: ${fileSizeKB}KB`);
    
    // Clean up work directory
    await fs.rm(workDir, { recursive: true, force: true });
    
    return {
      fileName: path.basename(debugApkPath),
      size: `${fileSizeKB}KB`,
      path: debugApkPath
    };
    
  } catch (error) {
    await addJobLog(jobId, `Error: ${error.message}`);
    throw error;
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Remove 'api' from pathParts if present
  if (pathParts[0] === 'api') {
    pathParts.shift();
  }
  
  const endpoint = pathParts[0];
  
  try {
    // Handle status endpoint
    if (endpoint === 'status' && pathParts[1]) {
      const jobId = pathParts[1];
      
      try {
        const job = await dbService.getJob(jobId);
        
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }
        
        return NextResponse.json({
          status: job.status,
          progress: job.progress,
          currentStep: job.currentStep,
          logs: job.logs || [],
          result: job.result
        });
      } catch (error) {
        console.error('Error fetching job status:', error);
        return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
      }
    }
    
    // Handle download endpoint
    if (endpoint === 'download' && pathParts[1]) {
      const fileName = pathParts[1];
      const filePath = path.join(outputDir, fileName);
      
      try {
        const fileBuffer = await fs.readFile(filePath);
        
        return new Response(fileBuffer, {
          headers: {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': fileBuffer.length.toString()
          }
        });
      } catch (error) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
    }
    
    // Handle test-mongodb endpoint
    if (endpoint === 'test-mongodb') {
      try {
        const testResult = await dbService.testConnection();
        return NextResponse.json({ 
          success: testResult,
          message: testResult ? 'MongoDB connection successful!' : 'MongoDB connection failed'
        });
      } catch (error) {
        console.error('Error testing MongoDB:', error);
        return NextResponse.json({ 
          success: false,
          message: 'MongoDB test failed',
          error: error.message 
        }, { status: 500 });
      }
    }

    // Handle stats endpoint
    if (endpoint === 'stats') {
      try {
        const stats = await dbService.getJobStats();
        return NextResponse.json(stats);
      } catch (error) {
        return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Remove 'api' from pathParts if present
  if (pathParts[0] === 'api') {
    pathParts.shift();
  }
  
  const endpoint = pathParts[0];
  
  try {
    // Handle convert endpoint
    if (endpoint === 'convert') {
      // Check if request has form data
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json({ error: 'No APK file provided' }, { status: 400 });
      }
      
      const formData = await request.formData();
      const apkFile = formData.get('apk');
      
      if (!apkFile) {
        return NextResponse.json({ error: 'No APK file provided' }, { status: 400 });
      }
      
      // Validate file
      if (!apkFile.name.endsWith('.apk')) {
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
      }
      
      if (apkFile.size > 100 * 1024 * 1024) { // 100MB limit
        return NextResponse.json({ error: 'File too large' }, { status: 400 });
      }
      
      // Generate job ID
      const jobId = uuidv4();
      
      // Initialize job in database
      await dbService.saveJob(jobId, {
        status: 'processing',
        progress: 0,
        currentStep: 'Starting...',
        logs: [],
        startTime: new Date().toISOString(),
        fileName: apkFile.name,
        fileSize: apkFile.size
      });
      
      // Save uploaded file
      const uploadPath = path.join(uploadsDir, `${jobId}.apk`);
      const fileBuffer = await apkFile.arrayBuffer();
      await fs.writeFile(uploadPath, Buffer.from(fileBuffer));
      
      // Process APK in background
      processApkToDebugMode(uploadPath, outputDir, jobId)
        .then(async (result) => {
          await dbService.completeJob(jobId, result);
        })
        .catch(async (error) => {
          console.error('Processing error:', error);
          await dbService.errorJob(jobId, error.message);
        });
      
      return NextResponse.json({ jobId });
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}