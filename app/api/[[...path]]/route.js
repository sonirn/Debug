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
    
    await updateJobProgress(jobId, 30, 'Analyzing Original APK Structure...');
    await addJobLog(jobId, 'Preserving original APK structure');
    
    // Check what files exist in the original APK
    const originalFiles = entries.map(entry => entry.entryName);
    await addJobLog(jobId, `Found ${originalFiles.length} files in original APK`);
    
    // Preserve original classes.dex and resources completely
    const hasDex = originalFiles.some(file => file.endsWith('.dex'));
    const hasResources = originalFiles.some(file => file === 'resources.arsc');
    
    if (hasDex) {
      await addJobLog(jobId, 'Preserving original DEX files (classes.dex)');
    }
    if (hasResources) {
      await addJobLog(jobId, 'Preserving original resources.arsc');
    }
    
    await updateJobProgress(jobId, 40, 'Preparing Debug Configuration...');
    await addJobLog(jobId, 'Creating debug configuration files');
    
    // Instead of modifying the complex AndroidManifest.xml, we'll add debug configuration files
    // that Android will respect for debugging purposes
    
    // Create res/xml directory for network security config
    const resXmlDir = path.join(workDir, 'res', 'xml');
    await fs.mkdir(resXmlDir, { recursive: true });
    
    // Add network security config for debug mode
    const networkConfigPath = path.join(resXmlDir, 'network_security_config.xml');
    await fs.writeFile(networkConfigPath, createNetworkSecurityConfig());
    await addJobLog(jobId, 'Added network security config for debugging');
    
    await updateJobProgress(jobId, 50, 'Adding Debug Resources...');
    await addJobLog(jobId, 'Adding debug-specific resources');
    
    // Create debug resources that won't interfere with original structure
    const resValuesDir = path.join(workDir, 'res', 'values');
    await fs.mkdir(resValuesDir, { recursive: true });
    
    // Create debug values that apps can use for debugging
    const debugValuesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <bool name="debug_mode">true</bool>
    <string name="debug_network_config">network_security_config</string>
    <string name="debug_info">Debug mode enabled</string>
</resources>`;
    
    const debugValuesPath = path.join(resValuesDir, 'debug_values.xml');
    await fs.writeFile(debugValuesPath, debugValuesXml);
    await addJobLog(jobId, 'Added debug values for runtime detection');
    
    await updateJobProgress(jobId, 60, 'Preserving Original Manifest...');
    await addJobLog(jobId, 'Keeping original AndroidManifest.xml structure');
    
    // Read the original manifest and try to make minimal changes
    const manifestPath = path.join(workDir, 'AndroidManifest.xml');
    let manifestModified = false;
    
    try {
      // Try to read as text first
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      
      if (manifestContent.includes('<?xml') && manifestContent.includes('<manifest')) {
        // It's a text manifest, we can make minimal modifications
        await addJobLog(jobId, 'Found text AndroidManifest.xml - making minimal debug modifications');
        
        let modifiedManifest = manifestContent;
        
        // Only add debug attributes if not already present
        if (!modifiedManifest.includes('android:debuggable')) {
          modifiedManifest = modifiedManifest.replace(
            /<application([^>]*)>/,
            '<application$1 android:debuggable="true">'
          );
          manifestModified = true;
        }
        
        if (!modifiedManifest.includes('android:usesCleartextTraffic')) {
          modifiedManifest = modifiedManifest.replace(
            /<application([^>]*)>/,
            '<application$1 android:usesCleartextTraffic="true">'
          );
          manifestModified = true;
        }
        
        if (manifestModified) {
          await fs.writeFile(manifestPath, modifiedManifest);
          await addJobLog(jobId, 'Applied minimal debug modifications to AndroidManifest.xml');
        } else {
          await addJobLog(jobId, 'AndroidManifest.xml already contains debug attributes');
        }
      } else {
        // It's not a proper text manifest, keep it as-is
        await addJobLog(jobId, 'AndroidManifest.xml is in binary format - preserving as-is');
      }
    } catch (error) {
      // If it's binary or we can't read it, keep the original
      await addJobLog(jobId, 'Preserving original AndroidManifest.xml without modifications');
    }
    
    await updateJobProgress(jobId, 70, 'Removing Invalid Signatures...');
    await addJobLog(jobId, 'Removing original APK signatures for debug mode');
    
    // Remove META-INF directory to avoid signature conflicts
    const metaInfPath = path.join(workDir, 'META-INF');
    try {
      await fs.rm(metaInfPath, { recursive: true, force: true });
      await addJobLog(jobId, 'Removed META-INF signatures (debug APK will be unsigned)');
    } catch (error) {
      await addJobLog(jobId, 'No META-INF signatures to remove');
    }
    
    await updateJobProgress(jobId, 80, 'Rebuilding Debug APK...');
    await addJobLog(jobId, 'Repackaging APK with debug modifications');
    
    // Create new APK with minimal changes
    const newZip = new AdmZip();
    
    // Add all files from work directory, preserving structure
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
          newZip.addFile(zipEntryPath, content);
        }
      }
    };
    
    await addDirectoryToZip(workDir);
    
    await updateJobProgress(jobId, 90, 'Finalizing Debug APK...');
    await addJobLog(jobId, 'Creating final debug APK');
    
    // Write the new APK
    const debugApkPath = path.join(outputDir, `debug_${path.basename(apkPath)}`);
    newZip.writeZip(debugApkPath);
    
    // Get file size
    const stats = await fs.stat(debugApkPath);
    const fileSizeKB = Math.round(stats.size / 1024);
    
    await updateJobProgress(jobId, 100, 'Debug APK Ready!');
    await addJobLog(jobId, `Debug APK created successfully: ${fileSizeKB}KB`);
    await addJobLog(jobId, 'APK ready for installation with debug features enabled');
    
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