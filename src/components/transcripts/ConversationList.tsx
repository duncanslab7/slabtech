'use client'

import { useState, useEffect } from 'react'
import { Card, Text } from '@/components'
import { ConversationCard } from './ConversationCard'
import { createClient } from '@/utils/supabase/client'
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

interface ConversationListProps {
  conversations: Conversation[]
  onConversationSelect?: (conversation: Conversation) => void
  onObjectionClick?: (timestamp: number) => void
  transcriptId?: string
  salespersonName?: string
}

export function ConversationList({ conversations, onConversationSelect, onObjectionClick, transcriptId, salespersonName }: ConversationListProps) {
  const [selectedCategory, setSelectedCategory] = useState<ConversationCategory | 'all'>('all')
  const [selectedObjection, setSelectedObjection] = useState<ObjectionType | 'all'>('all')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [favoritedConversations, setFavoritedConversations] = useState<Set<string>>(new Set())

  // Fetch favorited conversations on mount
  useEffect(() => {
    const fetchFavorites = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const conversationIds = conversations.map(c => c.id)
      if (conversationIds.length === 0) return

      const { data: favorites } = await supabase
        .from('user_favorites')
        .select('conversation_id')
        .eq('user_id', user.id)
        .in('conversation_id', conversationIds)

      if (favorites) {
        setFavoritedConversations(new Set(favorites.map(f => f.conversation_id)))
      }
    }

    fetchFavorites()
  }, [conversations])

  const handleToggleFavorite = async (conversationId: string, isFavorited: boolean) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('No user found')
      return
    }

    console.log('Toggling favorite:', { conversationId, isFavorited, userId: user.id })

    try {
      if (isFavorited) {
        // Remove from favorites
        console.log('Removing from favorites...')
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('conversation_id', conversationId)

        if (error) {
          console.error('Error removing favorite:', error)
          alert(`Failed to remove favorite: ${error.message}`)
          return
        }

        console.log('Successfully removed from favorites')
        setFavoritedConversations(prev => {
          const newSet = new Set(prev)
          newSet.delete(conversationId)
          return newSet
        })
      } else {
        // Add to favorites
        console.log('Adding to favorites...')
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Error fetching user profile:', profileError)
        }

        console.log('User profile:', userProfile)

        const { data, error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            company_id: userProfile?.company_id,
            conversation_id: conversationId,
            note: null
          })
          .select()

        if (error) {
          console.error('Error adding favorite:', error)
          alert(`Failed to add favorite: ${error.message}`)
          return
        }

        console.log('Successfully added to favorites:', data)
        setFavoritedConversations(prev => new Set(prev).add(conversationId))
      }
    } catch (error) {
      console.error('Unexpected error toggling favorite:', error)
      alert(`Unexpected error: ${error}`)
    }
  }

  // Calculate statistics
  const stats = {
    total: conversations.length,
    interactions: conversations.filter(c => c.category === 'interaction').length,
    pitches: conversations.filter(c => c.category === 'pitch').length,
    sales: conversations.filter(c => c.category === 'sale').length
  }

  // Get unique objections across all conversations
  const allObjections = new Set<ObjectionType>()
  conversations.forEach(c => {
    c.objections.forEach(obj => allObjections.add(obj))
  })

  // Filter conversations
  const filteredConversations = conversations.filter(conversation => {
    // Category filter
    if (selectedCategory !== 'all' && conversation.category !== selectedCategory) {
      return false
    }

    // Objection filter
    if (selectedObjection !== 'all' && !conversation.objections.includes(selectedObjection)) {
      return false
    }

    return true
  })

  const handleConversationClick = (conversation: Conversation) => {
    setActiveConversationId(conversation.id)
    onConversationSelect?.(conversation)
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <Text variant="muted" size="sm" className="uppercase tracking-wide mb-1 text-gray-600">
              Total
            </Text>
            <Text variant="emphasis" className="text-2xl font-bold text-gray-900">
              {stats.total}
            </Text>
          </div>
          <div className="text-center">
            <Text variant="muted" size="sm" className="uppercase tracking-wide mb-1 text-gray-600">
              Interactions
            </Text>
            <Text variant="emphasis" className="text-2xl font-bold text-blue-600">
              {stats.interactions}
            </Text>
          </div>
          <div className="text-center">
            <Text variant="muted" size="sm" className="uppercase tracking-wide mb-1 text-gray-600">
              Pitches
            </Text>
            <Text variant="emphasis" className="text-2xl font-bold text-yellow-600">
              {stats.pitches}
            </Text>
          </div>
          <div className="text-center">
            <Text variant="muted" size="sm" className="uppercase tracking-wide mb-1 text-gray-600">
              Sales
            </Text>
            <Text variant="emphasis" className="text-2xl font-bold text-green-600">
              {stats.sales}
            </Text>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <Text variant="emphasis" className="mb-3 text-gray-900">
          Filters
        </Text>

        <div className="space-y-3">
          {/* Category Filter */}
          <div>
            <Text variant="muted" size="sm" className="mb-2 text-gray-600">
              Category
            </Text>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-midnight-blue text-white'
                    : 'bg-gray-100 text-steel-gray hover:bg-gray-200'
                }`}
              >
                All ({conversations.length})
              </button>
              <button
                onClick={() => setSelectedCategory('interaction')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === 'interaction'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                }`}
              >
                Interactions ({stats.interactions})
              </button>
              <button
                onClick={() => setSelectedCategory('pitch')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === 'pitch'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                }`}
              >
                Pitches ({stats.pitches})
              </button>
              <button
                onClick={() => setSelectedCategory('sale')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === 'sale'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                }`}
              >
                Sales ({stats.sales})
              </button>
            </div>
          </div>

          {/* Objection Filter */}
          {allObjections.size > 0 && (
            <div>
              <Text variant="muted" size="sm" className="mb-2 text-gray-600">
                Objections
              </Text>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedObjection('all')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedObjection === 'all'
                      ? 'bg-midnight-blue text-white'
                      : 'bg-gray-100 text-steel-gray hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {Array.from(allObjections).map(objection => {
                  const count = conversations.filter(c => c.objections.includes(objection)).length
                  return (
                    <button
                      key={objection}
                      onClick={() => setSelectedObjection(objection)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedObjection === objection
                          ? 'bg-midnight-blue text-white'
                          : 'bg-gray-100 text-steel-gray hover:bg-gray-200'
                      }`}
                    >
                      {objection} ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div>
        <Text variant="emphasis" className="mb-3 text-gray-900">
          {filteredConversations.length} Conversation{filteredConversations.length !== 1 ? 's' : ''}
        </Text>

        {filteredConversations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <Text variant="muted" className="text-center text-gray-600">
              No conversations match the selected filters.
            </Text>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map(conversation => (
              <ConversationCard
                key={conversation.id}
                conversationId={conversation.id}
                conversationNumber={conversation.conversation_number}
                startTime={conversation.start_time}
                endTime={conversation.end_time}
                durationSeconds={conversation.duration_seconds}
                wordCount={conversation.word_count}
                category={conversation.category}
                objections={conversation.objections}
                objectionTimestamps={conversation.objection_timestamps}
                onClick={() => handleConversationClick(conversation)}
                onObjectionClick={onObjectionClick}
                onToggleFavorite={handleToggleFavorite}
                isActive={conversation.id === activeConversationId}
                isFavorited={favoritedConversations.has(conversation.id)}
                transcriptId={transcriptId}
                salespersonName={salespersonName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
