'use client'

import { Card, Text } from '@/components'
import { formatCategory, getCategoryColor, formatObjectionType, getObjectionColor } from '@/utils/conversationAnalysis'
import type { ObjectionType, ConversationCategory } from '@/utils/conversationAnalysis'

interface ObjectionTimestamp {
  type: ObjectionType
  text: string
  timestamp: number
}

interface ConversationCardProps {
  conversationNumber: number
  startTime: number
  endTime: number
  durationSeconds: number
  wordCount: number
  category: ConversationCategory
  objections: ObjectionType[]
  objectionTimestamps?: ObjectionTimestamp[]
  onClick?: () => void
  onObjectionClick?: (timestamp: number) => void
  isActive?: boolean
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
  startTime,
  endTime,
  durationSeconds,
  wordCount,
  category,
  objections,
  objectionTimestamps = [],
  onClick,
  onObjectionClick,
  isActive = false
}: ConversationCardProps) {
  return (
    <div onClick={onClick} className="cursor-pointer">
      <Card
        variant={isActive ? 'elevated' : 'outlined'}
        padding="md"
        className={`transition-all hover:shadow-lg ${
          isActive ? 'ring-2 ring-midnight-blue' : ''
        }`}
      >
        <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Text variant="emphasis" className="text-lg font-semibold">
              Conversation #{conversationNumber}
            </Text>
            <Text variant="muted" size="sm" className="font-mono">
              {formatTime(startTime)} - {formatTime(endTime)}
            </Text>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(category)}`}>
            {formatCategory(category)}
          </span>
        </div>

        {/* Metrics */}
        <div className="flex gap-4 text-xs text-steel-gray">
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
            <Text variant="muted" size="sm" className="uppercase tracking-wide mb-2">
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
          <Text variant="muted" size="sm" className="italic">
            No objections detected
          </Text>
        )}
        </div>
      </Card>
    </div>
  )
}
