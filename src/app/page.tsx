'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Salesperson {
  id: string
  name: string
  display_order: number
}

export default function Home() {
  const [salespersonId, setSalespersonId] = useState('')
  const [salespeople, setSalespeople] = useState<Salesperson[]>([])
  const [loadingSalespeople, setLoadingSalespeople] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Fetch salespeople on mount
  useEffect(() => {
    const fetchSalespeople = async () => {
      try {
        const response = await fetch('/api/salespeople')
        const data = await response.json()
        if (data.salespeople) {
          setSalespeople(data.salespeople)
        }
      } catch (error) {
        console.error('Error fetching salespeople:', error)
      } finally {
        setLoadingSalespeople(false)
      }
    }
    fetchSalespeople()
  }, [])

  const selectedSalesperson = salespeople.find(sp => sp.id === salespersonId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setUploadProgress('')

    try {
      if (!file) {
        throw new Error('Please select a file')
      }

      if (!salespersonId) {
        throw new Error('Please select a salesperson')
      }

      // Check file size (200MB limit)
      const maxSizeMB = 200
      const maxSizeBytes = maxSizeMB * 1024 * 1024
      if (file.size > maxSizeBytes) {
        throw new Error(`File size too large. Must be less than ${maxSizeMB}MB. Your file is ${Math.round(file.size / 1024 / 1024)}MB.`)
      }

      // Step 1: Upload file directly to Supabase Storage
      setUploadProgress('Uploading file to storage...')
      const supabase = createClient()

      const timestamp = Date.now()
      const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const filePath = fileName

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`)
      }

      // Step 2: Call API with just the file path and metadata
      setUploadProgress('Processing audio...')
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: filePath,
          originalFilename: file.name,
          salespersonId: salespersonId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process audio')
      }

      setMessage({
        type: 'success',
        text: 'Audio processed successfully! Your transcript has been saved.',
      })

      // Reset form
      setSalespersonId('')
      setFile(null)
      setUploadProgress('')
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'An error occurred while processing your audio',
      })
      setUploadProgress('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Processing Modal */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/20">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-500/30 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
              </div>
              <h3 className="text-xl font-bold text-white mt-6 mb-2">Processing</h3>
              <p className="text-purple-200 text-center">
                {uploadProgress || 'Please wait...'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            SLAB Voice
          </h1>
          <p className="text-lg text-purple-200">
            Upload call recordings for transcription
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white/10 backdrop-blur-lg shadow-2xl rounded-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Salesperson Selection */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-3">
                Select Salesperson <span className="text-pink-400">*</span>
              </label>

              {/* Custom Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  disabled={loading || loadingSalespeople}
                  className="w-full px-4 py-4 bg-white/5 border border-white/20 rounded-xl text-left focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className={selectedSalesperson ? 'text-white font-medium' : 'text-purple-300'}>
                      {loadingSalespeople
                        ? 'Loading...'
                        : selectedSalesperson
                          ? selectedSalesperson.name
                          : 'Choose a salesperson'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-purple-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-slate-800/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl overflow-hidden">
                    {salespeople.map((sp, index) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          setSalespersonId(sp.id)
                          setDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-purple-500/30 transition-colors duration-150 flex items-center gap-3 ${
                          salespersonId === sp.id ? 'bg-purple-500/20 text-purple-300' : 'text-white'
                        } ${index !== salespeople.length - 1 ? 'border-b border-white/10' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                          salespersonId === sp.id
                            ? 'bg-purple-500 text-white'
                            : 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                        }`}>
                          {sp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{sp.name}</span>
                        {salespersonId === sp.id && (
                          <svg className="w-5 h-5 ml-auto text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label
                htmlFor="file-upload"
                className="block text-sm font-medium text-purple-200 mb-3"
              >
                Audio File <span className="text-pink-400">*</span>
              </label>
              <div className={`mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-dashed rounded-xl transition-all duration-200 ${
                file
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
              }`}>
                <div className="space-y-2 text-center">
                  {file ? (
                    <div className="text-green-400">
                      <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  ) : (
                    <svg
                      className="mx-auto h-12 w-12 text-purple-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  <div className="flex text-sm text-purple-200 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md font-medium text-purple-400 hover:text-purple-300 focus-within:outline-none"
                    >
                      <span>{file ? 'Change file' : 'Upload a file'}</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept="audio/*,.mp3"
                        className="sr-only"
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0]
                          if (selectedFile) {
                            setFile(selectedFile)
                          }
                        }}
                        disabled={loading}
                      />
                    </label>
                    {!file && <p className="pl-1">or drag and drop</p>}
                  </div>
                  {file ? (
                    <p className="text-sm text-green-400 font-medium">
                      {file.name} ({Math.round(file.size / 1024 / 1024)}MB)
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-purple-300/70">MP3, WAV, or other audio formats</p>
                      <p className="text-xs text-purple-400 font-medium">
                        Maximum file size: 200MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading || !salespersonId || !file}
                className="w-full flex justify-center py-4 px-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
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
            </div>

            {/* Message Display */}
            {message && (
              <div
                className={`rounded-xl p-4 ${
                  message.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/30'
                    : 'bg-red-500/20 border border-red-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {message.type === 'success' ? (
                    <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                    {message.text}
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  )
}
