'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, Smartphone, Shield, Zap, Bug, Network, Code, Settings, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function APKDebugConverter() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [processedApk, setProcessedApk] = useState(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [jobId, setJobId] = useState('');

  const debugFeatures = [
    { icon: <Bug className="w-4 h-4" />, title: 'Core Debug Mode', description: 'android:debuggable="true" + backup enabled' },
    { icon: <Network className="w-4 h-4" />, title: 'Network Security', description: 'HTTP traffic, proxy support, SSL bypass' },
    { icon: <Code className="w-4 h-4" />, title: 'WebView Debugging', description: 'Chrome DevTools, JavaScript debugging' },
    { icon: <Settings className="w-4 h-4" />, title: 'Development Tools', description: 'ADB debugging, layout inspector' },
    { icon: <Shield className="w-4 h-4" />, title: 'Security Bypass', description: 'SSL pinning, root detection bypass' },
    { icon: <Zap className="w-4 h-4" />, title: 'Performance Debug', description: 'Memory profiling, GPU debugging' },
  ];

  const processSteps = [
    'Uploading APK...',
    'Validating APK Structure...',
    'Extracting APK Contents...',
    'Parsing AndroidManifest.xml...',
    'Applying Debug Modifications...',
    'Adding Network Security Config...',
    'Injecting Debug Features...',
    'Rebuilding APK...',
    'Signing with Debug Certificate...',
    'Finalizing Debug APK...'
  ];

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        setError('File size must be less than 100MB');
        return;
      }
      if (!file.name.endsWith('.apk')) {
        setError('Please select a valid APK file');
        return;
      }
      setSelectedFile(file);
      setError('');
      setProcessedApk(null);
      setProgress(0);
      setCurrentStep('');
      setLogs([]);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB');
        return;
      }
      if (!file.name.endsWith('.apk')) {
        setError('Please select a valid APK file');
        return;
      }
      setSelectedFile(file);
      setError('');
      setProcessedApk(null);
      setProgress(0);
      setCurrentStep('');
      setLogs([]);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const pollProgress = async (jobId) => {
    try {
      const response = await fetch(`/api/status/${jobId}`);
      const data = await response.json();
      
      if (data.status === 'processing') {
        setProgress(data.progress);
        setCurrentStep(data.currentStep);
        setLogs(data.logs || []);
        
        // Continue polling
        setTimeout(() => pollProgress(jobId), 1000);
      } else if (data.status === 'completed') {
        setProgress(100);
        setCurrentStep('Conversion Complete!');
        setProcessing(false);
        setProcessedApk(data.result);
      } else if (data.status === 'error') {
        setError(data.error);
        setProcessing(false);
        setProgress(0);
        setCurrentStep('');
      }
    } catch (error) {
      console.error('Error polling progress:', error);
      setError('Error checking progress');
      setProcessing(false);
    }
  };

  const convertToDebugMode = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProcessing(true);
    setError('');
    setProgress(0);
    setCurrentStep('Starting conversion...');

    try {
      const formData = new FormData();
      formData.append('apk', selectedFile);

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.jobId) {
        setJobId(data.jobId);
        setUploading(false);
        // Start polling for progress
        pollProgress(data.jobId);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      setError('Failed to process APK: ' + error.message);
      setUploading(false);
      setProcessing(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  const downloadDebugApk = async () => {
    if (!processedApk) return;

    try {
      const response = await fetch(`/api/download/${processedApk.fileName}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = processedApk.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError('Failed to download debug APK: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Smartphone className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              APK Debug Mode Converter
            </h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Convert any APK file to debug mode with all possible debugging features enabled. 
            Perfect for developers, security researchers, and reverse engineers.
          </p>
        </div>

        {/* Debug Features Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Debug Features Enabled
            </CardTitle>
            <CardDescription>
              All APKs will be automatically enhanced with these debugging capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {debugFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-green-50 border-green-200">
                  <div className="text-green-600 mt-1">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">{feature.title}</h3>
                    <p className="text-sm text-green-700">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload APK File</CardTitle>
            <CardDescription>
              Select your APK file (maximum 100MB) to convert to debug mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                {selectedFile ? selectedFile.name : 'Drop your APK file here or click to browse'}
              </p>
              <p className="text-sm text-gray-500">
                Supports APK files up to 100MB
              </p>
              <input
                id="file-upload"
                type="file"
                accept=".apk"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {selectedFile && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-blue-800">{selectedFile.name}</p>
                    <p className="text-sm text-blue-600">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Badge variant="secondary">Ready</Badge>
                </div>
              </div>
            )}

            {error && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Convert Button */}
        <div className="text-center">
          <Button
            onClick={convertToDebugMode}
            disabled={!selectedFile || uploading || processing}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {uploading || processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploading ? 'Uploading...' : 'Converting...'}
              </>
            ) : (
              <>
                <Bug className="w-4 h-4 mr-2" />
                Convert to Debug Mode
              </>
            )}
          </Button>
        </div>

        {/* Progress Section */}
        {(processing || progress > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing APK
              </CardTitle>
              <CardDescription>
                Converting your APK to debug mode with all features enabled
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{currentStep}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              
              {logs.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <h4 className="font-semibold mb-2">Processing Logs:</h4>
                  <div className="space-y-1 text-sm font-mono">
                    {logs.map((log, index) => (
                      <div key={index} className="text-gray-700">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Download Section */}
        {processedApk && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                Debug APK Ready!
              </CardTitle>
              <CardDescription>
                Your APK has been successfully converted to debug mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-800">{processedApk.fileName}</p>
                    <p className="text-sm text-green-600">
                      Size: {processedApk.size} | All debug features enabled
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Debug Mode</Badge>
                </div>
              </div>
              
              <Button
                onClick={downloadDebugApk}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Debug APK
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold">Security Notice</h3>
                <p className="text-sm text-gray-600">
                  Debug APKs have reduced security. Only use for development and testing purposes.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold">Installation</h3>
                <p className="text-sm text-gray-600">
                  Enable "Install from Unknown Sources" in your device settings to install debug APKs.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <Code className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold">Debugging</h3>
                <p className="text-sm text-gray-600">
                  Use Chrome DevTools (chrome://inspect) to debug WebViews in your converted APK.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}