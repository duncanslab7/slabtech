'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { useAudioUpload } from '@/hooks/useAudioUpload';

interface Transcript {
  id: string;
  created_at: string;
  salesperson_name: string;
  original_filename: string;
}

interface Salesperson {
  id: string;
  name: string;
  display_order: number;
}

export default function UserDashboard() {
  const [activeTab, setActiveTab] = useState<'upload' | 'transcripts'>('transcripts');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  // Upload form state
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [salespersonId, setSalespersonId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { loading: uploadLoading, uploadProgress, message, uploadAudio } = useAudioUpload({
    onSuccess: () => {
      setSalespersonId('');
      setFile(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
      }

      // Fetch assigned transcripts
      const { data: assignedTranscripts } = await supabase
        .from('transcript_assignments')
        .select(`
          transcript_id,
          transcripts (
            id,
            created_at,
            salesperson_name,
            original_filename
          )
        `)
        .order('assigned_at', { ascending: false });

      if (assignedTranscripts) {
        const transcriptList = assignedTranscripts
          .map((a: any) => a.transcripts)
          .filter(Boolean);
        setTranscripts(transcriptList);
      }

      // Fetch salespeople for upload form
      const response = await fetch('/api/salespeople');
      const data = await response.json();
      if (data.salespeople) {
        setSalespeople(data.salespeople);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !salespersonId) return;
    await uploadAudio(file, salespersonId);
  };

  const selectedSalesperson = salespeople.find(sp => sp.id === salespersonId);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-pure-white border-b-2 border-midnight-blue">
        <nav className="max-w-6xl mx-auto px-6 py-2">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/slab-logo.png"
                alt="SLAB"
                width={60}
                height={60}
                className="h-[60px] w-auto"
                priority
              />
            </Link>

            <div className="flex items-center gap-6">
              <span className="text-sm text-steel-gray">{userEmail}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-steel-gray hover:text-success-gold transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('transcripts')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'transcripts'
                  ? 'border-success-gold text-success-gold'
                  : 'border-transparent text-steel-gray hover:text-midnight-blue'
              }`}
            >
              View Transcripts
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'border-success-gold text-success-gold'
                  : 'border-transparent text-steel-gray hover:text-midnight-blue'
              }`}
            >
              Upload Recording
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'transcripts' ? (
          /* Transcripts List */
          <div>
            <h1 className="text-2xl font-bold text-midnight-blue mb-6">Your Transcripts</h1>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
              </div>
            ) : transcripts.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-steel-gray">No transcripts have been assigned to you yet.</p>
              </div>
            ) : (
              <>
                {/* Horizontal Scroll Indicator */}
                <div className="mb-4 flex items-center justify-center gap-2 text-xs text-steel-gray md:hidden">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  <span>Swipe to see more</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>

                <div className="bg-white rounded-lg shadow overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Salesperson
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Filename
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transcripts.map((transcript) => (
                      <tr key={transcript.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(transcript.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transcript.salesperson_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transcript.original_filename}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Link
                            href={`/user/transcripts/${transcript.id}`}
                            className="text-success-gold hover:text-amber-600 font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        ) : (
          /* Upload Form */
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-midnight-blue mb-6">Upload New Recording</h1>

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
                      disabled={uploadLoading}
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
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
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
                      disabled={uploadLoading}
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
                  disabled={uploadLoading || !salespersonId || !file}
                  className="w-full py-3 px-4 bg-success-gold text-white font-semibold rounded-lg hover:bg-amber-500 focus:ring-2 focus:ring-offset-2 focus:ring-success-gold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {uploadLoading ? (
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
        )}
      </div>
    </main>
  );
}
