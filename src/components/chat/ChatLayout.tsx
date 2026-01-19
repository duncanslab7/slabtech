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

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        onChannelCreated={loadChannels}
        loading={loading}
        companyId={companyId}
      />

      {/* Message Panel */}
      <div className="flex-1 flex flex-col">
        {activeChannel ? (
          <MessagePanel
            channel={activeChannel}
            onChannelUpdate={loadChannels}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-xl mb-2">Select a channel to start messaging</p>
              <p className="text-sm">or create a new conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
