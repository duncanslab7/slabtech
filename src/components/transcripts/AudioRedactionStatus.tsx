'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Props {
  transcriptId: string
}

export function AudioRedactionStatus({ transcriptId }: Props) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | undefined>()

  const handleRedact = async () => {
    setState('running')
    setError(undefined)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const resp = await fetch(`/api/transcripts/${transcriptId}/redact-audio`, {
        method: 'POST',
        headers: session?.access_token
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {},
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Audio redaction failed')
      }

      setState('done')
      // Reload page after a short delay so the player picks up the redacted URL
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      setError(e.message || 'Failed to redact audio')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-800">
        Audio redacted. Reloading...
      </div>
    )
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-4">
      <div className="text-sm text-orange-800">
        <strong>Audio not yet redacted.</strong> The transcript text has PII removed, but the original audio file is still unredacted.
        {state === 'error' && error && (
          <span className="block mt-1 text-red-700">{error}</span>
        )}
      </div>
      <button
        type="button"
        onClick={handleRedact}
        disabled={state === 'running'}
        className="flex-shrink-0 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'running' ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Redacting...
          </span>
        ) : 'Redact Audio'}
      </button>
    </div>
  )
}
