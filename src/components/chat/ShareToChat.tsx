'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface ShareToChatProps {
  transcriptId: string
  transcriptTitle?: string
  timestampStart?: number
  timestampEnd?: number
}

interface Channel {
  id: string
  channel_type: 'dm' | 'group'
  name: string
  picture_url?: string
}

export function ShareToChat({
  transcriptId,
  transcriptTitle,
  timestampStart,
  timestampEnd,
}: ShareToChatProps) {
  const [showModal, setShowModal] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  // Load channels when modal opens
  useEffect(() => {
    if (showModal) {
      loadChannels()
      // Set default message
      const timeRange = timestampStart && timestampEnd
        ? ` (${timestampStart}s - ${timestampEnd}s)`
        : ''
      setMessage(`Check out this audio${timeRange}`)
    }
  }, [showModal])

  async function loadChannels() {
    const response = await fetch('/api/chat/channels?limit=100')
    const { data } = await response.json()
    if (data?.channels) {
      setChannels(data.channels)
    }
  }

  async function handleShare() {
    if (!selectedChannelId) {
      setError('Please select a channel')
      return
    }

    if (!message.trim()) {
      setError('Please enter a message')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/chat/channels/${selectedChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message.trim(),
          transcriptId,
          timestampStart,
          timestampEnd,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to share')
      }

      // Success!
      setShowModal(false)
      setSelectedChannelId('')
      setMessage('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Share button */}
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-company-primary text-black rounded-md font-medium hover:opacity-90 transition-opacity"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share to Chat
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-company-primary">Share to Chat</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors text-2xl"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Transcript info */}
              {transcriptTitle && (
                <div className="mb-4 p-3 bg-gray-700 rounded-md">
                  <div className="text-sm text-gray-400">Sharing:</div>
                  <div className="font-semibold text-white">{transcriptTitle}</div>
                  {timestampStart && timestampEnd && (
                    <div className="text-sm text-gray-400 mt-1">
                      {timestampStart}s - {timestampEnd}s
                    </div>
                  )}
                </div>
              )}

              {/* Select channel */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Channel
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={`w-full p-3 rounded-md text-left transition-colors ${
                        selectedChannelId === channel.id
                          ? 'bg-company-primary text-black'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {channel.picture_url ? (
                          <img
                            src={channel.picture_url}
                            alt={channel.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold text-sm">
                            {channel.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="font-semibold">{channel.name}</div>
                      </div>
                    </button>
                  ))}

                  {channels.length === 0 && (
                    <div className="text-center text-gray-400 py-4">
                      No channels available. Create a chat first.
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Add a message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-company-primary resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-900 border border-red-700 rounded-md text-white text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={loading || !selectedChannelId}
                className="px-4 py-2 bg-company-primary text-black rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
