'use client'

import { useState } from 'react'
import { Heading } from '@/components'
import { ConversationList } from './ConversationList'
import { InteractiveAudioPlayer } from './InteractiveAudioPlayer'
import { TranscriptDisplay } from './TranscriptDisplay'
import type { ObjectionType, ConversationCategory } from '@/utils/conversationAnalysis'

interface ObjectionTimestamp {
  type: ObjectionType
  text: string
  timestamp: number
}

interface Conversation {
  id: string
  conversation_number: number
  start_time: number
  end_time: number
  duration_seconds: number
  word_count: number
  category: ConversationCategory
  objections: ObjectionType[]
  objection_timestamps?: ObjectionTimestamp[]
}

interface Word {
  word: string
  start: number
  end: number
  speaker?: string
}

interface PiiMatch {
  start: number
  end: number
  label: string
}

interface TranscriptWithConversationsProps {
  conversations: Conversation[] | null
  downloadUrl: string | undefined
  words: Word[]
  piiMatches: PiiMatch[]
  originalFilename: string
  transcriptText: string
  redactionConfigUsed: string
  transcriptData: any
  transcriptId?: string
  salespersonName?: string
  initialTimestamp?: number
  isSuperAdmin?: boolean
}

export function TranscriptWithConversations({
  conversations,
  downloadUrl,
  words,
  piiMatches,
  originalFilename,
  transcriptText,
  redactionConfigUsed,
  transcriptData,
  transcriptId,
  salespersonName,
  initialTimestamp,
  isSuperAdmin,
}: TranscriptWithConversationsProps) {
  const [seekToTime, setSeekToTime] = useState<number | undefined>(initialTimestamp)
  const [currentConversationIndex, setCurrentConversationIndex] = useState(0)
  const [redactMode, setRedactMode] = useState(false)
  const [selectedWordIndices, setSelectedWordIndices] = useState<Set<number>>(new Set())
  const [isApplyingRedaction, setIsApplyingRedaction] = useState(false)

  const handleConversationSelect = (conversation: Conversation) => {
    // Find the index of the selected conversation
    const index = conversations?.findIndex(c => c.id === conversation.id) ?? 0
    setCurrentConversationIndex(index)

    // Trigger seek to conversation start time
    setSeekToTime(conversation.start_time)
    // Reset after a brief delay to allow re-clicking the same conversation
    setTimeout(() => setSeekToTime(undefined), 100)
  }

  const handleNextConversation = () => {
    if (!conversations || conversations.length === 0) return
    const nextIndex = Math.min(currentConversationIndex + 1, conversations.length - 1)
    if (nextIndex !== currentConversationIndex) {
      setCurrentConversationIndex(nextIndex)
      setSeekToTime(conversations[nextIndex].start_time)
      setTimeout(() => setSeekToTime(undefined), 100)
    }
  }

  const handlePreviousConversation = () => {
    if (!conversations || conversations.length === 0) return
    const prevIndex = Math.max(currentConversationIndex - 1, 0)
    if (prevIndex !== currentConversationIndex) {
      setCurrentConversationIndex(prevIndex)
      setSeekToTime(conversations[prevIndex].start_time)
      setTimeout(() => setSeekToTime(undefined), 100)
    }
  }

  const handleObjectionClick = (timestamp: number) => {
    // Jump to the timestamp where the objection occurs
    setSeekToTime(timestamp)
    setTimeout(() => setSeekToTime(undefined), 100)
  }

  const handleWordRedactToggle = (index: number) => {
    setSelectedWordIndices(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleToggleRedactMode = () => {
    setRedactMode(prev => {
      if (prev) setSelectedWordIndices(new Set())
      return !prev
    })
  }

  const handleApplyRedaction = async () => {
    if (!transcriptId || selectedWordIndices.size === 0) return
    setIsApplyingRedaction(true)
    try {
      const ranges = Array.from(selectedWordIndices).map(idx => ({
        start: words[idx].start,
        end: words[idx].end,
        label: 'manual',
      }))

      const res = await fetch(`/api/admin/transcripts/${transcriptId}/redact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranges }),
      })

      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json()
        alert(`Redaction failed: ${data.error || 'Unknown error'}`)
        setIsApplyingRedaction(false)
      }
    } catch (err) {
      console.error('Redaction error:', err)
      setIsApplyingRedaction(false)
    }
  }

  return (
    <>
      {/* Conversations Section */}
      {conversations && conversations.length > 0 && (
        <div className="mb-8">
          <Heading level={2} size="lg" className="mb-4 text-gray-900">
            Conversations
          </Heading>
          <ConversationList
            conversations={conversations}
            onConversationSelect={handleConversationSelect}
            onObjectionClick={handleObjectionClick}
            transcriptId={transcriptId}
            salespersonName={salespersonName}
          />
        </div>
      )}

      {/* Super Admin Redact Controls */}
      {isSuperAdmin && downloadUrl && words.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleRedactMode}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                redactMode
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {redactMode ? 'Redact Mode: ON' : 'Redact Mode'}
            </button>
          </div>
          {redactMode && selectedWordIndices.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <span className="text-sm text-red-700">
                {selectedWordIndices.size} word(s) selected for redaction
              </span>
              <button
                onClick={handleApplyRedaction}
                disabled={isApplyingRedaction}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplyingRedaction ? 'Applying...' : 'Apply Redaction'}
              </button>
              <button
                onClick={() => setSelectedWordIndices(new Set())}
                className="px-3 py-1.5 bg-white text-red-700 border border-red-300 text-sm rounded-md hover:bg-red-50"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audio Player & Transcript */}
      {downloadUrl && words.length > 0 ? (
        <InteractiveAudioPlayer
          audioUrl={downloadUrl}
          words={words}
          piiMatches={piiMatches}
          originalFilename={originalFilename}
          seekToTime={seekToTime}
          conversations={conversations}
          currentConversationIndex={currentConversationIndex}
          onNextConversation={handleNextConversation}
          onPreviousConversation={handlePreviousConversation}
          transcriptId={transcriptId}
          redactMode={redactMode}
          selectedWordIndices={selectedWordIndices}
          onWordRedactToggle={handleWordRedactToggle}
        />
      ) : (
        <TranscriptDisplay
          transcriptText={transcriptText}
          redactionConfigUsed={redactionConfigUsed}
          transcriptData={transcriptData}
        />
      )}
    </>
  )
}
