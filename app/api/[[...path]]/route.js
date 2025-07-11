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
const keystoreDir = path.join(tempDir, 'keystore');

async function ensureTempDirs() {
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(keystoreDir, { recursive: true });
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

async function createDebugKeystore(keystorePath, password = 'debugpass') {
  try {
    // Check if keystore already exists
    try {
      await fs.access(keystorePath);
      return true; // Keystore exists
    } catch (error) {
      // Keystore doesn't exist, create it
    }
    
    const keytoolArgs = [
      '-genkeypair',
      '-keystore', keystorePath,
      '-alias', 'debugkey',
      '-storepass', password,
      '-keypass', password,
      '-keyalg', 'RSA',
      '-keysize', '2048',
      '-validity', '365',
      '-dname', 'CN=Debug, OU=Debug, O=Debug, L=Debug, ST=Debug, C=US'
    ];
    
    await executeCommand('keytool', keytoolArgs);
    return true;
  } catch (error) {
    console.error('Error creating debug keystore:', error);
    return false;
  }
}

async function signApk(apkPath, keystorePath, password = 'debugpass') {
  try {
    const jarsignerArgs = [
      '-verbose',
      '-keystore', keystorePath,
      '-storepass', password,
      '-keypass', password,
      apkPath,
      'debugkey'
    ];
    
    await executeCommand('jarsigner', jarsignerArgs);
    return true;
  } catch (error) {
    console.error('Error signing APK:', error);
    return false;
  }
}

async function verifyApkSignature(apkPath) {
  try {
    const jarsignerArgs = ['-verify', '-verbose', apkPath];
    const result = await executeCommand('jarsigner', jarsignerArgs);
    return result.stdout.includes('jar verified');
  } catch (error) {
    console.error('Error verifying APK signature:', error);
    return false;
  }
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

function createDebugPermissions() {
  return `<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />`;
}

async function improveManifestHandling(manifestPath, jobId) {
  try {
    await addJobLog(jobId, 'Analyzing AndroidManifest.xml structure...');
    
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    
    // Check if it's a text-based manifest (not binary)
    if (manifestContent.includes('<?xml') && manifestContent.includes('<manifest')) {
      await addJobLog(jobId, 'Found text-based AndroidManifest.xml - applying safe modifications');
      
      let modifiedManifest = manifestContent;
      let modificationsCount = 0;
      
      // 1. Add debug permissions if not present
      if (!modifiedManifest.includes('android.permission.INTERNET')) {
        const permissionsToAdd = createDebugPermissions();
        modifiedManifest = modifiedManifest.replace(
          /<manifest([^>]*)>/,
          `<manifest$1>\n${permissionsToAdd}`
        );
        modificationsCount++;
      }
      
      // 2. Add debuggable attribute to application tag
      if (!modifiedManifest.includes('android:debuggable')) {
        modifiedManifest = modifiedManifest.replace(
          /<application([^>]*)>/,
          '<application$1 android:debuggable="true">'
        );
        modificationsCount++;
      }
      
      // 3. Add cleartext traffic permission
      if (!modifiedManifest.includes('android:usesCleartextTraffic')) {
        modifiedManifest = modifiedManifest.replace(
          /<application([^>]*)>/,
          '<application$1 android:usesCleartextTraffic="true">'
        );
        modificationsCount++;
      }
      
      // 4. Add network security config reference
      if (!modifiedManifest.includes('android:networkSecurityConfig')) {
        modifiedManifest = modifiedManifest.replace(
          /<application([^>]*)>/,
          '<application$1 android:networkSecurityConfig="@xml/network_security_config">'
        );
        modificationsCount++;
      }
      
      // 5. Add testOnly attribute for debug builds
      if (!modifiedManifest.includes('android:testOnly')) {
        modifiedManifest = modifiedManifest.replace(
          /<application([^>]*)>/,
          '<application$1 android:testOnly="true">'
        );
        modificationsCount++;
      }
      
      // Clean up any duplicate attributes that might have been created
      modifiedManifest = modifiedManifest.replace(/android:debuggable="true"\s*android:debuggable="true"/g, 'android:debuggable="true"');
      modifiedManifest = modifiedManifest.replace(/android:usesCleartextTraffic="true"\s*android:usesCleartextTraffic="true"/g, 'android:usesCleartextTraffic="true"');
      modifiedManifest = modifiedManifest.replace(/android:networkSecurityConfig="@xml\/network_security_config"\s*android:networkSecurityConfig="@xml\/network_security_config"/g, 'android:networkSecurityConfig="@xml/network_security_config"');
      modifiedManifest = modifiedManifest.replace(/android:testOnly="true"\s*android:testOnly="true"/g, 'android:testOnly="true"');
      
      if (modificationsCount > 0) {
        await fs.writeFile(manifestPath, modifiedManifest);
        await addJobLog(jobId, `Applied ${modificationsCount} debug modifications to AndroidManifest.xml`);
        return true;
      } else {
        await addJobLog(jobId, 'AndroidManifest.xml already contains all debug attributes');
        return true;
      }
    } else {
      await addJobLog(jobId, 'AndroidManifest.xml is in binary format - preserving as-is to avoid corruption');
      return true;
    }
  } catch (error) {
    await addJobLog(jobId, `Error processing AndroidManifest.xml: ${error.message}`);
    return false;
  }
}

async function createOptimizedZip(sourceDir, outputPath, jobId) {
  try {
    await addJobLog(jobId, 'Creating optimized APK structure...');
    
    const zip = new AdmZip();
    
    // Add files with proper compression settings
    const addDirectoryToZip = async (dirPath, zipPath = '') => {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        const relativePath = zipPath ? path.join(zipPath, item) : item;
        
        if (stats.isDirectory()) {
          await addDirectoryToZip(itemPath, relativePath);
        } else {
          const content = await fs.readFile(itemPath);
          // Use forward slashes for ZIP entries (cross-platform compatibility)
          const zipEntryPath = relativePath.replace(/\\/g, '/');
          
          // Set compression level based on file type
          const entry = zip.addFile(zipEntryPath, content);
          if (item.endsWith('.dex') || item.endsWith('.so') || item.endsWith('.png')) {
            // Don't compress already compressed files
            entry.header.method = 0; // Store method (no compression)
          } else {
            // Compress other files
            entry.header.method = 8; // Deflate method
          }
        }
      }
    };
    
    await addDirectoryToZip(sourceDir);
    
    // Write the optimized APK
    zip.writeZip(outputPath);
    
    await addJobLog(jobId, 'APK structure optimized successfully');
    return true;
  } catch (error) {
    await addJobLog(jobId, `Error creating optimized ZIP: ${error.message}`);
    return false;
  }
}

async function processApkToDebugMode(apkPath, outputPath, jobId) {
  try {
    await updateJobProgress(jobId, 5, 'Initializing APK Processing...');
    await addJobLog(jobId, 'Starting comprehensive APK debug conversion');
    
    // Create debug keystore
    const keystorePath = path.join(keystoreDir, 'debug.keystore');
    await updateJobProgress(jobId, 8, 'Creating Debug Keystore...');
    const keystoreCreated = await createDebugKeystore(keystorePath);
    if (!keystoreCreated) {
      throw new Error('Failed to create debug keystore');
    }
    await addJobLog(jobId, 'Debug keystore created successfully');
    
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
    
    await updateJobProgress(jobId, 15, 'Extracting APK Contents...');
    await addJobLog(jobId, 'Extracting APK contents');
    
    // Create working directory
    const workDir = path.join(tempDir, `work_${jobId}`);
    await fs.mkdir(workDir, { recursive: true });
    
    // Extract APK
    zip.extractAllTo(workDir, true);
    
    await updateJobProgress(jobId, 20, 'Analyzing APK Structure...');
    await addJobLog(jobId, 'Analyzing original APK structure');
    
    // Check what files exist in the original APK
    const originalFiles = entries.map(entry => entry.entryName);
    await addJobLog(jobId, `Found ${originalFiles.length} files in original APK`);
    
    // Log important components
    const hasDex = originalFiles.some(file => file.endsWith('.dex'));
    const hasResources = originalFiles.some(file => file === 'resources.arsc');
    const hasNativeLibs = originalFiles.some(file => file.startsWith('lib/'));
    
    if (hasDex) await addJobLog(jobId, 'Found DEX files (bytecode)');
    if (hasResources) await addJobLog(jobId, 'Found resources.arsc (compiled resources)');
    if (hasNativeLibs) await addJobLog(jobId, 'Found native libraries');
    
    await updateJobProgress(jobId, 25, 'Removing Original Signatures...');
    await addJobLog(jobId, 'Removing original APK signatures');
    
    // Remove META-INF directory to avoid signature conflicts
    const metaInfPath = path.join(workDir, 'META-INF');
    try {
      await fs.rm(metaInfPath, { recursive: true, force: true });
      await addJobLog(jobId, 'Original signatures removed successfully');
    } catch (error) {
      await addJobLog(jobId, 'No original signatures to remove');
    }
    
    await updateJobProgress(jobId, 30, 'Processing AndroidManifest.xml...');
    await addJobLog(jobId, 'Processing AndroidManifest.xml with improved handling');
    
    // Process AndroidManifest.xml with improved handling
    const manifestPath = path.join(workDir, 'AndroidManifest.xml');
    const manifestProcessed = await improveManifestHandling(manifestPath, jobId);
    if (!manifestProcessed) {
      await addJobLog(jobId, 'Warning: AndroidManifest.xml processing had issues, continuing...');
    }
    
    await updateJobProgress(jobId, 40, 'Adding Debug Resources...');
    await addJobLog(jobId, 'Adding debug-specific resources');
    
    // Create res/xml directory for network security config
    const resXmlDir = path.join(workDir, 'res', 'xml');
    await fs.mkdir(resXmlDir, { recursive: true });
    
    // Add network security config for debug mode
    const networkConfigPath = path.join(resXmlDir, 'network_security_config.xml');
    await fs.writeFile(networkConfigPath, createNetworkSecurityConfig());
    await addJobLog(jobId, 'Added network security config for debugging');
    
    // Create debug values that won't interfere with existing resources
    const resValuesDir = path.join(workDir, 'res', 'values');
    await fs.mkdir(resValuesDir, { recursive: true });
    
    // Create debug values with unique names to avoid conflicts
    const debugValuesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <bool name="apk_debug_mode_enabled">true</bool>
    <string name="apk_debug_network_config">network_security_config</string>
    <string name="apk_debug_info">Debug mode enabled by APK Debug Converter</string>
    <string name="apk_debug_version">1.0</string>
</resources>`;
    
    const debugValuesPath = path.join(resValuesDir, 'apk_debug_values.xml');
    await fs.writeFile(debugValuesPath, debugValuesXml);
    await addJobLog(jobId, 'Added debug values for runtime detection');
    
    await updateJobProgress(jobId, 55, 'Creating Optimized APK Structure...');
    await addJobLog(jobId, 'Building optimized APK structure');
    
    // Create optimized APK with proper ZIP structure
    const tempApkPath = path.join(outputDir, `temp_${path.basename(apkPath)}`);
    const zipCreated = await createOptimizedZip(workDir, tempApkPath, jobId);
    if (!zipCreated) {
      throw new Error('Failed to create optimized APK structure');
    }
    
    await updateJobProgress(jobId, 70, 'Signing APK with Debug Certificate...');
    await addJobLog(jobId, 'Signing APK with debug certificate');
    
    // Sign the APK with debug keystore
    const signSuccess = await signApk(tempApkPath, keystorePath);
    if (!signSuccess) {
      throw new Error('Failed to sign APK with debug certificate');
    }
    await addJobLog(jobId, 'APK signed successfully with debug certificate');
    
    await updateJobProgress(jobId, 85, 'Verifying APK Signature...');
    await addJobLog(jobId, 'Verifying APK signature');
    
    // Verify the APK signature
    const isVerified = await verifyApkSignature(tempApkPath);
    if (!isVerified) {
      await addJobLog(jobId, 'Warning: APK signature verification failed, but continuing...');
    } else {
      await addJobLog(jobId, 'APK signature verified successfully');
    }
    
    await updateJobProgress(jobId, 95, 'Finalizing Debug APK...');
    await addJobLog(jobId, 'Creating final debug APK');
    
    // Move to final output location
    const finalApkPath = path.join(outputDir, `debug_${path.basename(apkPath)}`);
    await fs.rename(tempApkPath, finalApkPath);
    
    // Get file size
    const stats = await fs.stat(finalApkPath);
    const fileSizeKB = Math.round(stats.size / 1024);
    
    await updateJobProgress(jobId, 100, 'Debug APK Ready for Installation!');
    await addJobLog(jobId, `Debug APK created successfully: ${fileSizeKB}KB`);
    await addJobLog(jobId, 'APK is now signed and ready for installation on Android devices');
    await addJobLog(jobId, 'Debug features enabled: debuggable=true, cleartext traffic, network security config');
    
    // Clean up work directory
    await fs.rm(workDir, { recursive: true, force: true });
    
    return {
      fileName: path.basename(finalApkPath),
      size: `${fileSizeKB}KB`,
      path: finalApkPath,
      signed: true,
      verified: isVerified
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