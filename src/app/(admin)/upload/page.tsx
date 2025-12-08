'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Heading, Text, Container } from '@/components';

interface Salesperson {
  id: string;
  name: string;
  display_order: number;
}

export default function AdminUploadPage() {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [salespersonId, setSalespersonId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchSalespeople = async () => {
      const response = await fetch('/api/salespeople');
      const data = await response.json();
      if (data.salespeople) {
        setSalespeople(data.salespeople);
      }
    };
    fetchSalespeople();
  }, []);

  const selectedSalesperson = salespeople.find(sp => sp.id === salespersonId);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setUploadProgress('');

    try {
      if (!file) {
        throw new Error('Please select a file');
      }

      if (!salespersonId) {
        throw new Error('Please select a salesperson');
      }

      const maxSizeMB = 200;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new Error(`File size too large. Must be less than ${maxSizeMB}MB.`);
      }

      setUploadProgress('Uploading file to storage...');
      const supabase = createClient();

      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      setUploadProgress('Processing audio...');
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: filePath,
          originalFilename: file.name,
          salespersonId: salespersonId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process audio');
      }

      setMessage({
        type: 'success',
        text: 'Audio processed successfully! Your transcript has been saved.',
      });

      setSalespersonId('');
      setFile(null);
      setUploadProgress('');
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'An error occurred',
      });
      setUploadProgress('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" padding="lg">
      <div className="mb-8">
        <Heading level={1} size="xl">
          Upload New Recording
        </Heading>
        <Text variant="muted" className="mt-2">
          Upload and process a new call recording
        </Text>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-lg shadow p-8">
          <form onSubmit={handleUpload} className="space-y-6">
            {/* Salesperson Selection */}
            <div>
              <label className="block text-sm font-medium text-midnight-blue mb-2">
                Select Salesperson <span className="text-red-500">*</span>
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left focus:ring-2 focus:ring-success-gold focus:border-transparent transition-all hover:border-gray-400 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className={selectedSalesperson ? 'text-charcoal' : 'text-gray-400'}>
                      {selectedSalesperson ? selectedSalesperson.name : 'Choose a salesperson'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {dropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {salespeople.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          setSalespersonId(sp.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                          salespersonId === sp.id ? 'bg-amber-50 text-success-gold' : 'text-charcoal'
                        }`}
                      >
                        {sp.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-midnight-blue mb-2">
                Audio File <span className="text-red-500">*</span>
              </label>
              <div className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'
              }`}>
                {file ? (
                  <div className="text-green-600 pointer-events-none">
                    <svg className="mx-auto h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm">({Math.round(file.size / 1024 / 1024)}MB)</p>
                  </div>
                ) : (
                  <div className="text-gray-500 pointer-events-none">
                    <svg className="mx-auto h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm">Drop an audio file here or click to browse</p>
                    <p className="text-xs mt-1">MP3, WAV, or other audio formats (max 200MB)</p>
                  </div>
                )}
                <input
                  id="file-upload"
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) setFile(selectedFile);
                  }}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`rounded-lg p-4 ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !salespersonId || !file}
              className="w-full py-3 px-4 bg-success-gold text-white font-semibold rounded-lg hover:bg-amber-500 focus:ring-2 focus:ring-offset-2 focus:ring-success-gold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {uploadProgress || 'Processing...'}
                </span>
              ) : (
                'Upload and Process'
              )}
            </button>
          </form>
        </div>
      </div>
    </Container>
  );
}
