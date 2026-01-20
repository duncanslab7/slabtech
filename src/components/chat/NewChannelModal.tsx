'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface NewChannelModalProps {
  companyId: string
  onClose: () => void
  onChannelCreated: () => void
}

interface User {
  id: string
  display_name: string
  profile_picture_url?: string
  email: string
}

export function NewChannelModal({ companyId, onClose, onChannelCreated }: NewChannelModalProps) {
  const [channelType, setChannelType] = useState<'dm' | 'group'>('dm')
  const [companyUsers, setCompanyUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  // Fetch company users
  useEffect(() => {
    async function loadUsers() {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, profile_picture_url, email')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('display_name')

      if (error) {
        console.error('Error loading users:', error)
      } else if (data) {
        // Filter out current user
        const { data: { user } } = await supabase.auth.getUser()
        setCompanyUsers(data.filter((u: User) => u.id !== user?.id))
      }
    }

    loadUsers()
  }, [companyId])

  async function handleCreate() {
    setError('')
    setLoading(true)

    try {
      if (channelType === 'dm') {
        if (!selectedUserId) {
          setError('Please select a user to message')
          setLoading(false)
          return
        }

        const response = await fetch('/api/chat/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'dm',
            targetUserId: selectedUserId,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create DM')
        }

        onChannelCreated()
      } else {
        // Group
        if (!groupName.trim()) {
          setError('Please enter a group name')
          setLoading(false)
          return
        }

        const response = await fetch('/api/chat/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'group',
            name: groupName.trim(),
            description: groupDescription.trim() || undefined,
            memberIds: selectedUserIds,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create group')
        }

        onChannelCreated()
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] md:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-company-primary">New Conversation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Channel Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Conversation Type
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setChannelType('dm')}
                className={`flex-1 p-3 rounded-md border-2 transition-colors ${
                  channelType === 'dm'
                    ? 'border-company-primary bg-gray-700 text-white'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="font-semibold">Direct Message</div>
                <div className="text-sm">1-on-1 conversation</div>
              </button>
              <button
                onClick={() => setChannelType('group')}
                className={`flex-1 p-3 rounded-md border-2 transition-colors ${
                  channelType === 'group'
                    ? 'border-company-primary bg-gray-700 text-white'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="font-semibold">Group Chat</div>
                <div className="text-sm">Multiple people</div>
              </button>
            </div>
          </div>

          {/* DM Selection */}
          {channelType === 'dm' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select User
              </label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {companyUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full p-3 rounded-md text-left transition-colors ${
                      selectedUserId === user.id
                        ? 'bg-company-primary text-black'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {user.profile_picture_url ? (
                        <img
                          src={user.profile_picture_url}
                          alt={user.display_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold">
                          {user.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">{user.display_name}</div>
                        <div className="text-sm opacity-75">{user.email}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group Creation */}
          {channelType === 'group' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-company-primary"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What's this group about?"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-company-primary resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Add Members ({selectedUserIds.length} selected)
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {companyUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleUserSelection(user.id)}
                      className={`w-full p-3 rounded-md text-left transition-colors ${
                        selectedUserIds.includes(user.id)
                          ? 'bg-company-primary text-black'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {user.profile_picture_url ? (
                          <img
                            src={user.profile_picture_url}
                            alt={user.display_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold">
                            {user.display_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-semibold">{user.display_name}</div>
                          <div className="text-sm opacity-75">{user.email}</div>
                        </div>
                        {selectedUserIds.includes(user.id) && (
                          <div className="text-xl">✓</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-900 border border-red-700 rounded-md text-white text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 md:px-4 md:py-2 min-h-[44px] md:min-h-0 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 md:px-4 md:py-2 min-h-[44px] md:min-h-0 bg-company-primary text-black rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
