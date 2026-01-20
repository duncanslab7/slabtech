'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ChannelSidebar } from './ChannelSidebar'
import { MessagePanel } from './MessagePanel'

interface Channel {
  id: string
  channel_type: 'dm' | 'group'
  name: string
  description?: string
  picture_url?: string
  created_by: string
  created_at: string
  updated_at: string
  last_message?: any
  unread_count: number
  members: any[]
  other_members: any[]
}

export function ChatLayout({ companyId }: { companyId: string }) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const supabase = createClient()

  // Fetch channels
  async function loadChannels() {
    setLoading(true)
    const response = await fetch('/api/chat/channels?limit=100')
    const { data, error } = await response.json()

    if (error) {
      console.error('Failed to load channels:', error)
    } else if (data?.channels) {
      setChannels(data.channels)

      // If no active channel but have channels, select first one
      if (!activeChannelId && data.channels.length > 0) {
        setActiveChannelId(data.channels[0].id)
      }
    }

    setLoading(false)
  }

  // Initial load
  useEffect(() => {
    loadChannels()
  }, [])

  // Subscribe to channel updates
  useEffect(() => {
    const channelSubscription = supabase
      .channel(`user-channels:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          // Reload channels on any change
          loadChannels()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          // Update last message preview for affected channel
          const messageChannelId = (payload.new as any).channel_id
          setChannels(prev =>
            prev.map(ch => {
              if (ch.id === messageChannelId) {
                return {
                  ...ch,
                  updated_at: new Date().toISOString(),
                }
              }
              return ch
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelSubscription)
    }
  }, [companyId])

  const activeChannel = channels.find(ch => ch.id === activeChannelId)

  // On mobile, close sidebar when selecting a channel
  function handleSelectChannel(channelId: string) {
    setActiveChannelId(channelId)
    // Close sidebar on mobile after selecting
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }

  // On mobile, open sidebar when going back
  function handleBackToChannels() {
    setSidebarOpen(true)
    if (window.innerWidth < 768) {
      setActiveChannelId(null)
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 relative overflow-hidden">
      {/* Mobile: Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        fixed md:relative
        z-50 md:z-0
        transition-transform duration-300 ease-in-out
        h-full
      `}>
        <ChannelSidebar
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={handleSelectChannel}
          onChannelCreated={loadChannels}
          loading={loading}
          companyId={companyId}
        />
      </div>

      {/* Message Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <MessagePanel
            channel={activeChannel}
            onChannelUpdate={loadChannels}
            onBack={handleBackToChannels}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 p-4">
            <div className="text-center">
              <p className="text-xl mb-2">Select a channel to start messaging</p>
              <p className="text-sm">or create a new conversation</p>
              <button
                onClick={() => setSidebarOpen(true)}
                className="mt-4 md:hidden bg-company-primary text-black px-4 py-2 rounded-md font-medium"
              >
                Open Channels
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Floating button to toggle sidebar (when channel is active) */}
      {activeChannel && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed top-20 right-4 bg-company-primary text-black p-3 rounded-full shadow-lg z-30"
          aria-label="Open channels"
        >
          ☰
        </button>
      )}
    </div>
  )
}
