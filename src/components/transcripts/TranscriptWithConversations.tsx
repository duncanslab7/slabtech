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
  salespersonName
}: TranscriptWithConversationsProps) {
  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined)
  const [currentConversationIndex, setCurrentConversationIndex] = useState(0)

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
