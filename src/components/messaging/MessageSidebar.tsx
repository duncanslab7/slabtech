'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Message {
  id: string
  message_text: string
  created_at: string
  user_profiles: {
    display_name: string
  }
  transcript_id: string | null
}

export function MessageSidebar({ companyId }: { companyId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!isOpen) return

    // Load initial messages
    async function loadMessages() {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('id, message_text, created_at, transcript_id, user_profiles!inner(display_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) {
        console.error('Failed to load messages:', error)
      } else if (data) {
        setMessages(data as Message[])
      }
      setLoading(false)
    }

    loadMessages()

    // Subscribe to new messages with realtime
    const channel = supabase
      .channel('company-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `company_id=eq.${companyId}`,
        },
        async (payload) => {
          // Fetch the full message with user profile
          const { data } = await supabase
            .from('messages')
            .select('id, message_text, created_at, transcript_id, user_profiles!inner(display_name)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages((prev) => [...prev, data as Message])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, companyId])

  async function sendMessage() {
    if (!newMessage.trim()) return

    const messageText = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX

    const { error } = await supabase.from('messages').insert({
      company_id: companyId,
      message_text: messageText,
    })

    if (error) {
      console.error('Failed to send message:', error)
      // Restore message on error
      setNewMessage(messageText)
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-4 bottom-4 bg-company-primary text-black p-4 rounded-full shadow-lg z-50 hover:opacity-90 transition-opacity"
        title="Team Chat"
      >
        💬
      </button>

      {/* Sidebar */}
      {isOpen && (
        <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800">
            <h2 className="text-xl font-bold text-company-primary">Team Chat</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors">
                  <div className="text-xs text-gray-400 mb-1">
                    {msg.user_profiles.display_name} •{' '}
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="text-white text-sm whitespace-pre-wrap break-words">
                    {msg.message_text}
                  </div>
                  {msg.transcript_id && (
                    <div className="mt-2 text-xs text-blue-400 flex items-center gap-1">
                      🔊 Shared audio clip
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-700 bg-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-company-primary"
                maxLength={2000}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="bg-company-primary text-black px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </div>
      )}
    </>
  )
}
