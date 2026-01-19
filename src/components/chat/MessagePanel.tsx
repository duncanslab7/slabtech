'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'

interface Message {
  id: string
  message_text: string
  created_at: string
  user_id: string
  transcript_id?: string
  timestamp_start?: number
  timestamp_end?: number
  user_profiles: {
    id: string
    display_name: string
    profile_picture_url?: string
    email: string
  }
  reactions_grouped?: Array<{
    emoji: string
    count: number
    users: Array<{ user_id: string; display_name: string }>
  }>
}

interface MessagePanelProps {
  channel: {
    id: string
    channel_type: 'dm' | 'group'
    name: string
    description?: string
    picture_url?: string
    created_by: string
    members: any[]
  }
  onChannelUpdate: () => void
}

export function MessagePanel({ channel, onChannelUpdate }: MessagePanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load messages
  async function loadMessages(before?: string) {
    if (before) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    const url = before
      ? `/api/chat/channels/${channel.id}/messages?limit=50&before=${before}`
      : `/api/chat/channels/${channel.id}/messages?limit=50`

    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      console.error('Failed to load messages:', data.error)
    } else {
      const newMessages = (data.messages || []).map((msg: any) => ({
        ...msg,
        user_profiles: Array.isArray(msg.user_profiles) ? msg.user_profiles[0] : msg.user_profiles
      }))

      if (before) {
        // Prepend older messages
        setMessages(prev => [...newMessages.reverse(), ...prev])
      } else {
        // Initial load or refresh
        setMessages(newMessages.reverse())
        // Scroll to bottom after initial load
        setTimeout(scrollToBottom, 100)
      }

      setHasMore(data.has_more)
    }

    setLoading(false)
    setLoadingMore(false)
  }

  // Initial load
  useEffect(() => {
    loadMessages()

    // Mark as read when opening channel
    markAsRead()
  }, [channel.id])

  // Subscribe to new messages
  useEffect(() => {
    const messageChannel = supabase
      .channel(`channel-messages:${channel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channel.id}`,
        },
        async (payload) => {
          // Fetch full message with user profile
          const { data } = await supabase
            .from('chat_messages')
            .select(`
              id,
              message_text,
              created_at,
              user_id,
              transcript_id,
              timestamp_start,
              timestamp_end,
              user_profiles!chat_messages_user_id_fkey(id, display_name, profile_picture_url, email)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            // Transform the data to match Message interface (user_profiles is an array from Supabase)
            const transformedData: Message = {
              ...data,
              user_profiles: Array.isArray(data.user_profiles) ? data.user_profiles[0] : data.user_profiles
            }
            setMessages(prev => [...prev, transformedData])
            setTimeout(scrollToBottom, 100)

            // Mark as read
            markAsRead(data.id)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
        },
        async () => {
          // Reload messages to get updated reactions
          // In production, you'd update locally for better performance
          loadMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
        },
        async () => {
          // Reload messages to get updated reactions
          loadMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messageChannel)
    }
  }, [channel.id])

  // Handle scroll for infinite loading
  function handleScroll() {
    const container = messagesContainerRef.current
    if (!container || loadingMore || !hasMore) return

    // If scrolled to top, load more
    if (container.scrollTop < 100) {
      const oldestMessage = messages[0]
      if (oldestMessage) {
        loadMessages(oldestMessage.created_at)
      }
    }
  }

  // Mark channel as read
  async function markAsRead(messageId?: string) {
    const lastMessageId = messageId || messages[messages.length - 1]?.id
    if (!lastMessageId) return

    await fetch(`/api/chat/channels/${channel.id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: lastMessageId }),
    })

    onChannelUpdate()
  }

  // Handle message sent
  function handleMessageSent(message: Message) {
    setMessages(prev => [...prev, message])
    setTimeout(scrollToBottom, 100)
    markAsRead(message.id)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3">
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
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{channel.name}</h2>
            {channel.description && (
              <p className="text-sm text-gray-400">{channel.description}</p>
            )}
            {!channel.description && channel.members && (
              <p className="text-sm text-gray-400">
                {channel.members.length} member{channel.members.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {loadingMore && (
          <div className="text-center text-gray-400 py-2">Loading more...</div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null
            const showAvatar = !prevMessage || prevMessage.user_id !== message.user_id

            return (
              <MessageBubble
                key={message.id}
                message={message}
                showAvatar={showAvatar}
                channelId={channel.id}
                onReactionChange={loadMessages}
              />
            )
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer
        channelId={channel.id}
        onMessageSent={handleMessageSent}
      />
    </div>
  )
}
