'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Salesperson {
  id: string
  name: string
  display_order: number
}

interface Transcript {
  id: string
  created_at: string
  salesperson_name: string
  salesperson_id: string | null
  original_filename: string
  redaction_config_used: string
}

export default function DashboardPage() {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([])
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [selectedTab, setSelectedTab] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch salespeople
        const spResponse = await fetch('/api/admin/salespeople')
        const spData = await spResponse.json()
        if (spData.salespeople) {
          setSalespeople(spData.salespeople)
        }

        // Fetch transcripts
        const response = await fetch('/api/admin/transcripts')
        const data = await response.json()
        if (data.transcripts) {
          setTranscripts(data.transcripts)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filter transcripts based on selected tab
  const filteredTranscripts = transcripts.filter((t) => {
    if (selectedTab === 'all') return true
    return t.salesperson_id === selectedTab
  })

  // Get count for each salesperson
  const getCount = (spId: string) => {
    return transcripts.filter((t) => t.salesperson_id === spId).length
  }

  // Handle delete transcript
  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/transcripts/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        alert(`Failed to delete transcript: ${data.error || 'Unknown error'}`)
        return
      }

      // Remove from local state
      setTranscripts((prev) => prev.filter((t) => t.id !== id))
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting transcript:', error)
      alert('Failed to delete transcript')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-200">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Transcripts Dashboard
            </h1>
            <p className="text-purple-200 mt-1">
              View and manage all call recordings and transcriptions
            </p>
          </div>
          <Link
            href="/config"
            className="rounded-xl bg-white/10 backdrop-blur px-4 py-2 text-white hover:bg-white/20 transition-all border border-white/20"
          >
            Configure Settings
          </Link>
        </div>

        {/* Salesperson Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {/* All Tab */}
            <button
              onClick={() => setSelectedTab('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                selectedTab === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20 border border-white/10'
              }`}
            >
              All
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                selectedTab === 'all'
                  ? 'bg-white/20'
                  : 'bg-white/10'
              }`}>
                {transcripts.length}
              </span>
            </button>

            {/* Salesperson Tabs */}
            {salespeople.map((sp) => (
              <button
                key={sp.id}
                onClick={() => setSelectedTab(sp.id)}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                  selectedTab === sp.id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-white/10 text-purple-200 hover:bg-white/20 border border-white/10'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  selectedTab === sp.id
                    ? 'bg-white/20'
                    : 'bg-gradient-to-br from-purple-600 to-pink-600'
                }`}>
                  {sp.name.charAt(0).toUpperCase()}
                </div>
                {sp.name}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  selectedTab === sp.id
                    ? 'bg-white/20'
                    : 'bg-white/10'
                }`}>
                  {getCount(sp.id)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal Scroll Indicator */}
        {filteredTranscripts.length > 0 && (
          <div className="mb-4 flex items-center justify-center gap-2 text-xs text-purple-300 lg:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <span>Swipe to see more</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        )}

        {/* Transcripts Table */}
        {filteredTranscripts.length === 0 ? (
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p className="text-purple-200 text-lg">
              {selectedTab === 'all'
                ? 'No transcripts yet. Upload your first audio file to get started.'
                : `No transcripts for ${salespeople.find(sp => sp.id === selectedTab)?.name || 'this salesperson'} yet.`
              }
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="lg:hidden space-y-4">
              {filteredTranscripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-4"
                >
                  {/* Header with Salesperson */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
                        {transcript.salesperson_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-semibold">
                          {transcript.salesperson_name}
                        </div>
                        <div className="text-purple-300 text-xs">
                          {formatDate(transcript.created_at)}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {transcript.redaction_config_used}
                    </span>
                  </div>

                  {/* Filename */}
                  <div className="mb-4 pb-3 border-b border-white/10">
                    <div className="text-purple-300 text-xs mb-1">Filename</div>
                    <div className="text-purple-200 text-sm break-all">
                      {transcript.original_filename}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/transcripts/${transcript.id}`}
                      className="flex-1 text-center py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium transition-all hover:shadow-lg hover:shadow-purple-500/25"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm(transcript.id)}
                      className="p-2.5 rounded-xl text-red-400 hover:text-red-300 transition-colors hover:bg-red-500/10 border border-red-500/30"
                      title="Delete transcript"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block bg-white/10 backdrop-blur rounded-2xl border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                        Salesperson
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                        Filename
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                        Config Used
                      </th>
                      <th className="px-6 py-4 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredTranscripts.map((transcript) => (
                      <tr key={transcript.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-white text-sm">{formatDate(transcript.created_at)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-sm font-bold">
                              {transcript.salesperson_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-white font-medium text-sm">
                              {transcript.salesperson_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-purple-200 text-sm truncate max-w-xs block">
                            {transcript.original_filename}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {transcript.redaction_config_used}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/transcripts/${transcript.id}`}
                              className="text-purple-400 hover:text-purple-300 transition-colors font-medium text-sm inline-flex items-center gap-1"
                            >
                              View Details
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => setDeleteConfirm(transcript.id)}
                              className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-500/10 rounded-lg"
                              title="Delete transcript"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-between items-center">
          <p className="text-purple-300 text-sm">
            Showing {filteredTranscripts.length} of {transcripts.length} transcripts
          </p>
          <Link
            href="/admin"
            className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </Link>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl border border-white/20 shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Delete Transcript</h3>
                  <p className="text-purple-300 text-sm">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-purple-200 mb-6">
                Are you sure you want to delete this transcript?{' '}
                <span className="font-medium text-white">
                  {transcripts.find((t) => t.id === deleteConfirm)?.original_filename}
                </span>
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-medium transition-all shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
