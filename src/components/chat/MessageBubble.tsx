'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

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
  }
  reactions_grouped?: Array<{
    emoji: string
    count: number
    users: Array<{ user_id: string; display_name: string }>
  }>
}

interface MessageBubbleProps {
  message: Message
  showAvatar: boolean
  channelId: string
  onReactionChange: () => void
}

export function MessageBubble({ message, showAvatar, channelId, onReactionChange }: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  const isOwnMessage = message.user_id === currentUserId

  // Add reaction
  async function addReaction(emoji: string) {
    const response = await fetch(`/api/chat/messages/${message.id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    })

    if (response.ok) {
      onReactionChange()
    }

    setShowReactionPicker(false)
  }

  // Remove reaction
  async function removeReaction(emoji: string) {
    const response = await fetch(`/api/chat/messages/${message.id}/reactions/${encodeURIComponent(emoji)}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      onReactionChange()
    }
  }

  // Handle reaction click
  function handleReactionClick(emoji: string) {
    const reaction = message.reactions_grouped?.find(r => r.emoji === emoji)
    const userReacted = reaction?.users.some(u => u.user_id === currentUserId)

    if (userReacted) {
      removeReaction(emoji)
    } else {
      addReaction(emoji)
    }
  }

  // Handle transcript link click
  function handleTranscriptClick() {
    if (message.transcript_id) {
      router.push(`/transcripts/${message.transcript_id}?t=${message.timestamp_start}`)
    }
  }

  const commonEmojis = ['👍', '❤️', '😂', '🎉', '🤔', '👏']

  return (
    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {showAvatar ? (
          message.user_profiles.profile_picture_url ? (
            <img
              src={message.user_profiles.profile_picture_url}
              alt={message.user_profiles.display_name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold">
              {message.user_profiles.display_name.charAt(0).toUpperCase()}
            </div>
          )
        ) : (
          <div className="w-10 h-10" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-2xl ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {showAvatar && (
          <div className={`text-sm font-semibold text-gray-300 mb-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
            {message.user_profiles.display_name}
          </div>
        )}

        <div className="relative group">
          <div
            className={`rounded-lg p-3 ${
              isOwnMessage
                ? 'bg-company-primary text-black'
                : 'bg-gray-700 text-white'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message.message_text}</p>

            {/* Transcript Link */}
            {message.transcript_id && (
              <button
                onClick={handleTranscriptClick}
                className={`mt-2 text-sm underline flex items-center gap-1 ${
                  isOwnMessage ? 'text-black opacity-80 hover:opacity-100' : 'text-blue-400 hover:text-blue-300'
                }`}
              >
                🔊 Audio clip ({message.timestamp_start}s - {message.timestamp_end}s)
              </button>
            )}

            {/* Timestamp */}
            <div className={`text-xs mt-1 ${isOwnMessage ? 'text-black opacity-60' : 'text-gray-400'}`}>
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Reaction Button */}
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="absolute -top-2 right-2 bg-gray-600 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-500"
            title="Add reaction"
          >
            +
          </button>

          {/* Reaction Picker */}
          {showReactionPicker && (
            <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 flex gap-1 z-10">
              {commonEmojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => addReaction(emoji)}
                  className="w-8 h-8 text-xl hover:bg-gray-700 rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reactions */}
        {message.reactions_grouped && message.reactions_grouped.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.reactions_grouped.map((reaction) => {
              const userReacted = reaction.users.some(u => u.user_id === currentUserId)

              return (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReactionClick(reaction.emoji)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
                    userReacted
                      ? 'bg-company-primary text-black'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                  title={reaction.users.map(u => u.display_name).join(', ')}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-xs">{reaction.count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
