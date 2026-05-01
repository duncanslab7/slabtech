'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { parseTimestampInput, formatSeconds } from '@/utils/timestampParsing'

type Mode = 'continuous' | 'edited_clips' | 'manual_timestamps'

interface Props {
  transcriptId: string
  currentRecordingType: Mode
}

export function ReSegmentControl({ transcriptId, currentRecordingType }: Props) {
  const [target, setTarget] = useState<Mode>(currentRecordingType)
  const [manualInput, setManualInput] = useState<string>('')
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | undefined>()
  const [result, setResult] = useState<{ count: number } | undefined>()

  const parseResult = useMemo(
    () => target === 'manual_timestamps' ? parseTimestampInput(manualInput) : null,
    [target, manualInput]
  )

  const manualInvalid =
    target === 'manual_timestamps' &&
    (!parseResult || parseResult.ranges.length === 0 || parseResult.errors.length > 0)

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
        body: JSON.stringify({
          recordingType: target,
          manualTimestamps: target === 'manual_timestamps' ? parseResult?.ranges : undefined,
        }),
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
          onChange={(e) => setTarget(e.target.value as Mode)}
          disabled={state === 'running'}
          className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
        >
          <option value="continuous">Continuous Recording</option>
          <option value="edited_clips">Pre-edited Clips</option>
          <option value="manual_timestamps">Manual Timestamps</option>
        </select>
        <button
          type="button"
          onClick={handleReSegment}
          disabled={state === 'running' || manualInvalid}
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

      {target === 'manual_timestamps' && (
        <div className="mt-3">
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={`One range per line (start - end):\n00:00 - 02:30\n02:35 - 04:50`}
            rows={6}
            disabled={state === 'running'}
            className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm bg-white"
          />
          {parseResult && (
            <div className="mt-1 text-xs">
              {parseResult.ranges.length > 0 && (
                <span className="text-green-700">
                  ✓ {parseResult.ranges.length} range{parseResult.ranges.length === 1 ? '' : 's'} parsed
                </span>
              )}
              {parseResult.errors.length > 0 && (
                <div className="text-red-700 mt-1 space-y-0.5">
                  {parseResult.errors.map((err, i) => (
                    <div key={i}>Line {err.line}: {err.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
