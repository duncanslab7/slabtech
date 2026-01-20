'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ChannelSettingsMenuProps {
  channelId: string
  channelType: 'dm' | 'group'
  isCreator: boolean
  isCompanyAdmin: boolean
  onArchived?: () => void
  onLeft?: () => void
}

export function ChannelSettingsMenu({
  channelId,
  channelType,
  isCreator,
  isCompanyAdmin,
  onArchived,
  onLeft,
}: ChannelSettingsMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleArchive() {
    if (!confirm('Archive this conversation? You can unarchive it later.')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/chat/channels/${channelId}/archive`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to archive')
      }

      setShowMenu(false)
      if (onArchived) onArchived()
      router.push(window.location.pathname) // Refresh
    } catch (error) {
      console.error('Error archiving channel:', error)
      alert('Failed to archive conversation')
    } finally {
      setLoading(false)
    }
  }

  async function handleLeave() {
    if (!confirm('Leave this group? You can be re-added by an admin.')) return

    setLoading(true)
    try {
      const { data: { user } } = await (await import('@/utils/supabase/client')).createClient().auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const response = await fetch(`/api/chat/channels/${channelId}/members/${user.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to leave')
      }

      setShowMenu(false)
      if (onLeft) onLeft()
      router.push(window.location.pathname) // Refresh
    } catch (error) {
      console.error('Error leaving channel:', error)
      alert('Failed to leave group')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this group permanently? This cannot be undone!')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/chat/channels/${channelId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      setShowMenu(false)
      router.push(window.location.pathname) // Refresh
    } catch (error) {
      console.error('Error deleting channel:', error)
      alert('Failed to delete group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Settings button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="text-gray-400 hover:text-white transition-colors p-2"
        aria-label="Channel settings"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {/* Menu dropdown */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 py-1">
            {/* Archive (DMs and groups) */}
            <button
              onClick={handleArchive}
              disabled={loading}
              className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Archive
            </button>

            {/* Leave (groups only) */}
            {channelType === 'group' && (
              <button
                onClick={handleLeave}
                disabled={loading}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Leave Group
              </button>
            )}

            {/* Delete (super admin only, or creator/company admin for groups) */}
            {channelType === 'group' && (isCreator || isCompanyAdmin) && (
              <>
                <div className="border-t border-gray-700 my-1" />
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Group
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
