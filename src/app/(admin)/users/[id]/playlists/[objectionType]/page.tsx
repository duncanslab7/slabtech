'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Heading, Text, Card, Container } from '@/components'
import { formatObjectionType, getObjectionColor } from '@/utils/conversationAnalysis'
import { InteractiveAudioPlayer } from '@/components/transcripts/InteractiveAudioPlayer'

interface Conversation {
  id: string
  conversation_number: number
  start_time: number
  end_time: number
  duration_seconds: number
  word_count: number
  category: string
  objections: string[]
  objection_timestamps: Array<{ type: string; text: string; timestamp: number }>
  transcript_id: string
  audioUrl: string
  originalFilename: string
  salespersonName: string
  transcriptCreatedAt: string
}

interface PlaylistData {
  user: {
    id: string
    name: string
  }
  objectionType: string
  totalConversations: number
  conversations: Conversation[]
}

export default function PlaylistViewerPage({
  params
}: {
  params: Promise<{ id: string; objectionType: string }>
}) {
  const { id: userId, objectionType } = use(params)
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined)

  useEffect(() => {
    fetchPlaylist()
  }, [userId, objectionType])

  const fetchPlaylist = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/playlists/${objectionType}`)
      const data = await response.json()

      if (response.ok) {
        setPlaylist(data)
      } else {
        console.error('Failed to fetch playlist:', data.error)
      }
    } catch (error) {
      console.error('Error fetching playlist:', error)
    }
    setLoading(false)
  }

  const handleConversationSelect = (index: number) => {
    setCurrentIndex(index)
    const conversation = playlist?.conversations[index]
    if (conversation) {
      setSeekToTime(conversation.start_time)
      setTimeout(() => setSeekToTime(undefined), 100)
    }
  }

  const handleNext = () => {
    if (!playlist || currentIndex >= playlist.conversations.length - 1) return
    handleConversationSelect(currentIndex + 1)
  }

  const handlePrevious = () => {
    if (currentIndex <= 0) return
    handleConversationSelect(currentIndex - 1)
  }

  if (loading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-gold"></div>
        </div>
      </Container>
    )
  }

  if (!playlist || playlist.conversations.length === 0) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card variant="outlined" padding="lg" className="text-center">
          <Text variant="muted">No conversations found for this objection type</Text>
          <Link
            href={`/users/${userId}`}
            className="text-success-gold hover:underline mt-4 inline-block"
          >
            Back to User Profile
          </Link>
        </Card>
      </Container>
    )
  }

  const currentConversation = playlist.conversations[currentIndex]

  return (
    <Container maxWidth="xl" padding="lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href={`/users/${userId}`} className="text-steel-gray hover:text-midnight-blue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <Heading level={1} size="xl">
              {formatObjectionType(objectionType as any)} Training Playlist
            </Heading>
            <Text variant="muted">
              {playlist.user.name} • {playlist.totalConversations} conversation
              {playlist.totalConversations !== 1 ? 's' : ''}
            </Text>
          </div>
        </div>
      </div>

      {/* Current Conversation Info */}
      <Card variant="outlined" padding="lg" className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Text variant="emphasis" className="text-lg font-semibold">
              Conversation {currentIndex + 1} of {playlist.conversations.length}
            </Text>
            <Text variant="muted" size="sm" className="mt-1">
              From: {currentConversation.originalFilename}
            </Text>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getObjectionColor(objectionType as any)}`}>
            {formatObjectionType(objectionType as any)}
          </span>
        </div>

        {/* Playlist Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              currentIndex === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-midnight-blue text-white hover:bg-steel-gray'
            }`}
          >
            ← Previous Conversation
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === playlist.conversations.length - 1}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              currentIndex === playlist.conversations.length - 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-midnight-blue text-white hover:bg-steel-gray'
            }`}
          >
            Next Conversation →
          </button>
        </div>

        {/* Audio Player */}
        <div className="mt-4">
          <InteractiveAudioPlayer
            audioUrl={currentConversation.audioUrl}
            words={[]}
            piiMatches={[]}
            originalFilename={currentConversation.originalFilename}
            hideDownload={true}
            seekToTime={seekToTime}
          />
        </div>
      </Card>

      {/* Conversation List */}
      <Card variant="outlined" padding="lg">
        <Heading level={2} size="lg" className="mb-4">
          All Conversations in Playlist
        </Heading>
        <div className="space-y-2">
          {playlist.conversations.map((conv, index) => (
            <button
              key={conv.id}
              onClick={() => handleConversationSelect(index)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                index === currentIndex
                  ? 'border-success-gold bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Text variant="emphasis" className="font-semibold">
                      #{index + 1}
                    </Text>
                    <Text variant="muted" size="sm" className="truncate">
                      {conv.originalFilename}
                    </Text>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-steel-gray">
                    <span>Conversation #{conv.conversation_number}</span>
                    <span>•</span>
                    <span>{Math.floor(conv.duration_seconds / 60)}m {Math.floor(conv.duration_seconds % 60)}s</span>
                    <span>•</span>
                    <span>{conv.word_count} words</span>
                  </div>
                </div>
                {index === currentIndex && (
                  <div className="ml-4">
                    <svg className="w-6 h-6 text-success-gold" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </Container>
  )
}
