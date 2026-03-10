'use client'

import { useState } from 'react'

interface TranscriptResult {
  id: string
  salesperson_name: string
  newMatchCount: number
  status: string
}

export function ReprocessPiiButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<TranscriptResult[] | null>(null)
  const [salespersonName, setSalespersonName] = useState('Rylan')

  const handleRun = async () => {
    setStatus('running')
    setResults(null)
    try {
      const res = await fetch('/api/admin/transcripts/reprocess-pii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salespersonName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      setResults(data.transcripts)
      setStatus('done')
    } catch (err: any) {
      console.error(err)
      setStatus('error')
    }
  }

  const updated = results?.filter(r => r.status === 'updated') ?? []
  const skipped = results?.filter(r => r.status !== 'updated') ?? []

  return (
    <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-orange-50">
          <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      </div>

      <h3 className="text-base font-semibold text-gray-900 mb-1">Re-Process PII Redaction</h3>
      <p className="text-sm text-gray-600 mb-4">
        Re-scan transcripts with Claude to find any missed credit cards, phone numbers, emails, or numeric sequences and re-redact both audio and text.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={salespersonName}
          onChange={e => setSalespersonName(e.target.value)}
          placeholder="Salesperson name"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          onClick={handleRun}
          disabled={status === 'running' || !salespersonName.trim()}
          className="px-4 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {status === 'running' ? 'Running...' : 'Run Reprocess'}
        </button>
      </div>

      {status === 'running' && (
        <p className="text-sm text-gray-500 italic">This can take a few minutes for many transcripts...</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-red-600">Something went wrong. Check the console for details.</p>
      )}

      {status === 'done' && results && (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-gray-800">
            Done — {updated.length} updated, {skipped.length} skipped
          </p>
          {updated.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-1">
              {updated.map(r => (
                <div key={r.id} className="text-green-800">
                  {r.salesperson_name} — {r.newMatchCount} new redaction{r.newMatchCount !== 1 ? 's' : ''}
                </div>
              ))}
            </div>
          )}
          {skipped.length > 0 && (
            <details className="text-gray-500 cursor-pointer">
              <summary>{skipped.length} transcript{skipped.length !== 1 ? 's' : ''} with no new matches</summary>
              <div className="mt-1 space-y-0.5 pl-2">
                {skipped.map(r => (
                  <div key={r.id}>{r.salesperson_name} — {r.status}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
