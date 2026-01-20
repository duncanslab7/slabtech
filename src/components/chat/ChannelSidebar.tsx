'use client'

import { useState } from 'react'
import { NewChannelModal } from './NewChannelModal'

interface Channel {
  id: string
  channel_type: 'dm' | 'group'
  name: string
  picture_url?: string
  last_message?: any
  unread_count: number
  updated_at: string
}

interface ChannelSidebarProps {
  channels: Channel[]
  activeChannelId: string | null
  onSelectChannel: (channelId: string) => void
  onChannelCreated: () => void
  loading: boolean
  companyId: string
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  onChannelCreated,
  loading,
  companyId,
}: ChannelSidebarProps) {
  const [showNewChannelModal, setShowNewChannelModal] = useState(false)

  // Sort channels by most recent activity
  const sortedChannels = [...channels].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  return (
    <>
      <div className="w-full md:w-80 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-company-primary">Messages</h2>
            <button
              onClick={() => setShowNewChannelModal(true)}
              className="bg-company-primary text-black px-3 py-1 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              title="New conversation"
            >
              + New
            </button>
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400">Loading...</div>
          ) : channels.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <p className="mb-2">No conversations yet</p>
              <p className="text-sm">Click "New" to start chatting</p>
            </div>
          ) : (
            <div>
              {sortedChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel.id)}
                  className={`w-full p-4 text-left hover:bg-gray-700 transition-colors border-l-4 ${
                    activeChannelId === channel.id
                      ? 'bg-gray-700 border-company-primary'
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {channel.picture_url ? (
                        <img
                          src={channel.picture_url}
                          alt={channel.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold">
                          {channel.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white truncate">
                          {channel.name}
                        </span>
                        {channel.unread_count > 0 && (
                          <span className="bg-company-primary text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                            {channel.unread_count}
                          </span>
                        )}
                      </div>

                      {channel.last_message && (
                        <div className="flex items-center gap-1 text-sm text-gray-400 truncate">
                          <span className="truncate">
                            {channel.last_message.user_profiles?.display_name}:{' '}
                            {channel.last_message.message_text}
                          </span>
                        </div>
                      )}

                      {!channel.last_message && (
                        <div className="text-sm text-gray-500 italic">
                          No messages yet
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Channel Modal */}
      {showNewChannelModal && (
        <NewChannelModal
          companyId={companyId}
          onClose={() => setShowNewChannelModal(false)}
          onChannelCreated={() => {
            setShowNewChannelModal(false)
            onChannelCreated()
          }}
        />
      )}
    </>
  )
}
