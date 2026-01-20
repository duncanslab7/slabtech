'use client'

import { useState } from 'react'
import { Card, Text, ShareToChat } from '@/components'
import { formatCategory, getCategoryColor, formatObjectionType, getObjectionColor } from '@/utils/conversationAnalysis'
import type { ObjectionType, ConversationCategory } from '@/utils/conversationAnalysis'

interface ObjectionTimestamp {
  type: ObjectionType
  text: string
  timestamp: number
}

interface ConversationCardProps {
  conversationNumber: number
  conversationId: string
  startTime: number
  endTime: number
  durationSeconds: number
  wordCount: number
  category: ConversationCategory
  objections: ObjectionType[]
  objectionTimestamps?: ObjectionTimestamp[]
  onClick?: () => void
  onObjectionClick?: (timestamp: number) => void
  onToggleFavorite?: (conversationId: string, isFavorited: boolean) => void
  isActive?: boolean
  isFavorited?: boolean
  transcriptId?: string
  salespersonName?: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins === 0) {
    return `${secs}s`
  }
  return `${mins}m ${secs}s`
}

export function ConversationCard({
  conversationNumber,
  conversationId,
  startTime,
  endTime,
  durationSeconds,
  wordCount,
  category,
  objections,
  objectionTimestamps = [],
  onClick,
  onObjectionClick,
  onToggleFavorite,
  isActive = false,
  isFavorited = false,
  transcriptId,
  salespersonName
}: ConversationCardProps) {
  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger conversation click
    onToggleFavorite?.(conversationId, isFavorited);
  };
  return (
    <div onClick={onClick} className="cursor-pointer">
      <div
        className={`bg-white rounded-lg shadow-sm border p-4 transition-all hover:shadow-lg ${
          isActive ? 'ring-2 ring-success-gold border-success-gold' : 'border-gray-200'
        }`}
      >
        <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Text variant="emphasis" className="text-lg font-semibold text-gray-900">
              Conversation #{conversationNumber}
            </Text>
            <Text variant="muted" size="sm" className="font-mono text-gray-600">
              {formatTime(startTime)} - {formatTime(endTime)}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            {transcriptId && (
              <div onClick={(e) => e.stopPropagation()}>
                <ShareToChat
                  transcriptId={transcriptId}
                  transcriptTitle={salespersonName || `Conversation #${conversationNumber}`}
                  timestampStart={startTime}
                  timestampEnd={endTime}
                  iconOnly
                />
              </div>
            )}
            <button
              onClick={handleStarClick}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorited ? (
                <svg className="w-6 h-6 text-success-gold fill-current" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-400 hover:text-success-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              )}
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(category)}`}>
              {formatCategory(category)}
            </span>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDuration(durationSeconds)}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span>{wordCount} words</span>
          </div>
        </div>

        {/* Objections */}
        {objections.length > 0 && (
          <div>
            <Text variant="muted" size="sm" className="uppercase tracking-wide mb-2 text-gray-600">
              Objections
            </Text>
            <div className="flex flex-wrap gap-2">
              {objections.map((objection, idx) => {
                const objectionWithTimestamp = objectionTimestamps.find(o => o.type === objection)
                const hasTimestamp = objectionWithTimestamp && onObjectionClick

                return (
                  <button
                    key={idx}
                    onClick={(e) => {
                      if (hasTimestamp) {
                        e.stopPropagation() // Don't trigger conversation click
                        onObjectionClick(objectionWithTimestamp.timestamp)
                      }
                    }}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${getObjectionColor(objection)} ${
                      hasTimestamp ? 'cursor-pointer hover:ring-2 hover:ring-midnight-blue hover:shadow-md' : 'cursor-default'
                    }`}
                    title={hasTimestamp ? `Jump to: "${objectionWithTimestamp.text}"` : undefined}
                  >
                    {formatObjectionType(objection)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {objections.length === 0 && (
          <Text variant="muted" size="sm" className="italic text-gray-500">
            No objections detected
          </Text>
        )}
        </div>
      </div>
    </div>
  )
}
