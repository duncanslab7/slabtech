'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Props {
  transcriptId: string
  currentRecordingType: 'continuous' | 'edited_clips'
}

export function ReSegmentControl({ transcriptId, currentRecordingType }: Props) {
  const [target, setTarget] = useState<'continuous' | 'edited_clips'>(currentRecordingType)
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | undefined>()
  const [result, setResult] = useState<{ count: number } | undefined>()

  const handleReSegment = async () => {
    setState('running')
    setError(undefined)
    setResult(undefined)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const resp = await fetch(`/api/transcripts/${transcriptId}/re-segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ recordingType: target }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Re-segmentation failed')

      setResult({ count: data.conversationCount })
      setState('done')
      setTimeout(() => window.location.reload(), 2000)
    } catch (e: any) {
      setError(e.message || 'Failed to re-segment')
      setState('error')
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
      <div className="text-sm text-blue-900 font-semibold mb-2">Admin: Re-segment Conversations</div>
      <div className="text-xs text-blue-800 mb-3">
        Wipe and rebuild conversation rows using the selected mode. Useful when the wrong recording type was picked at upload, or for old transcripts uploaded before the toggle existed.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as any)}
          disabled={state === 'running'}
          className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
        >
          <option value="continuous">Continuous Recording</option>
          <option value="edited_clips">Pre-edited Clips</option>
        </select>
        <button
          type="button"
          onClick={handleReSegment}
          disabled={state === 'running'}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {state === 'running' ? 'Re-segmenting…' : 'Re-segment'}
        </button>
        {state === 'done' && result && (
          <span className="text-sm text-green-700">
            Built {result.count} conversation{result.count === 1 ? '' : 's'}. Reloading…
          </span>
        )}
        {state === 'error' && error && (
          <span className="text-sm text-red-700">{error}</span>
        )}
      </div>
    </div>
  )
}
