'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Props {
  transcriptId: string
  initialStatus: string
  initialError?: string
}

const POLL_INTERVAL_MS = 15_000

export function TranscriptProcessingStatus({ transcriptId, initialStatus, initialError }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState<string | undefined>(initialError)
  const [message, setMessage] = useState('Click "Check Status" to resume processing')
  const [isPolling, setIsPolling] = useState(false)

  const checkStatus = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const resp = await fetch(`/api/transcripts/${transcriptId}/status`, {
        headers: session?.access_token
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {},
      })
      const data = await resp.json()

      if (data.status === 'completed') {
        setStatus('completed')
        setMessage('Processing complete! Refreshing...')
        setTimeout(() => window.location.reload(), 1500)
        return true
      }

      if (data.status === 'error') {
        setStatus('error')
        setError(data.error || 'Processing failed')
        setMessage('')
        setIsPolling(false)
        return true
      }

      // Still processing
      setStatus('processing')
      setError(undefined)
      setMessage(data.message || 'Processing...')
      return false
    } catch (e: any) {
      console.error('Status check error:', e)
      setError(e.message || 'Failed to check status')
      setIsPolling(false)
      return true
    }
  }, [transcriptId])

  // Start polling when isPolling is true
  useEffect(() => {
    if (!isPolling) return

    let cancelled = false
    let timer: NodeJS.Timeout | null = null

    const tick = async () => {
      if (cancelled) return
      const done = await checkStatus()
      if (!done && !cancelled) {
        timer = setTimeout(tick, POLL_INTERVAL_MS)
      }
    }

    tick() // Run immediately

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [isPolling, checkStatus])

  const handleStart = () => {
    setIsPolling(true)
    setError(undefined)
    setMessage('Checking transcription status...')
  }

  const handleStop = () => {
    setIsPolling(false)
    setMessage('Polling stopped. Click "Check Status" to resume.')
  }

  return (
    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {isPolling ? (
            <svg className="animate-spin h-8 w-8 text-yellow-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : status === 'error' ? (
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-900 mb-1">
            {status === 'error' ? 'Processing Error' : 'Transcript Processing'}
          </h3>
          <p className="text-yellow-800 mb-3">{message}</p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-3 text-sm text-red-800">
              <strong>Error:</strong> {error}
            </div>
          )}
          <p className="text-sm text-yellow-700 mb-3">
            For large files, transcription can take 20–60 minutes. Click below to check status and finish processing when ready.
          </p>
          <div className="flex gap-2">
            {!isPolling ? (
              <button
                type="button"
                onClick={handleStart}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
              >
                Check Status / Retry
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                Stop Polling
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
