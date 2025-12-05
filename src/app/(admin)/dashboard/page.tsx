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
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 overflow-hidden">
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
                        <Link
                          href={`/transcripts/${transcript.id}`}
                          className="text-purple-400 hover:text-purple-300 transition-colors font-medium text-sm inline-flex items-center gap-1"
                        >
                          View Details
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
      </div>
    </div>
  )
}
