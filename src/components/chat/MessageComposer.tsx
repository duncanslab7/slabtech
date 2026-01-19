'use client'

import { useState } from 'react'

interface MessageComposerProps {
  channelId: string
  onMessageSent: (message: any) => void
}

export function MessageComposer({ channelId, onMessageSent }: MessageComposerProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function sendMessage() {
    if (!message.trim() || sending) return

    setError('')
    setSending(true)

    const messageText = message.trim()
    setMessage('') // Clear immediately for better UX

    try {
      const response = await fetch(`/api/chat/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: messageText }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      onMessageSent(data.message)
    } catch (err: any) {
      setError(err.message)
      setMessage(messageText) // Restore message on error
    } finally {
      setSending(false)
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="p-4 border-t border-gray-700 bg-gray-800">
      {error && (
        <div className="mb-2 p-2 bg-red-900 border border-red-700 rounded-md text-white text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-company-primary resize-none"
          rows={1}
          maxLength={5000}
          disabled={sending}
          style={{
            minHeight: '40px',
            maxHeight: '200px',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = target.scrollHeight + 'px'
          }}
        />

        <button
          onClick={sendMessage}
          disabled={!message.trim() || sending}
          className="bg-company-primary text-black px-6 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>

      <div className="text-xs text-gray-500 mt-1">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  )
}
