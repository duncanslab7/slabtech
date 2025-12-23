'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Heading, Text, Card } from '@/components'

interface StreakData {
  user_id: string
  current_streak: number
  longest_streak: number
  total_activities: number
  last_activity_date: string | null
  display_name: string
  email: string
  rank: number
}

const WEEK_COLORS = [
  'from-red-500 to-orange-500',
  'from-orange-500 to-yellow-500',
  'from-yellow-500 to-green-500',
  'from-green-500 to-blue-500',
  'from-blue-500 to-indigo-500',
  'from-indigo-500 to-purple-500',
]

export default function CompanyLeaderboard() {
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<StreakData[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      // Get current user to find company
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user profile with company info
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('companies!inner(id)')
        .eq('id', user.id)
        .single()

      if (!profile) return

      // Fetch leaderboard
      const { data: streaks } = await supabase
        .from('user_streaks')
        .select('user_id, current_streak, longest_streak, total_activities, last_activity_date, user_profiles!inner(display_name, email, is_active)')
        .eq('company_id', (profile.companies as any)?.id)
        .eq('user_profiles.is_active', true)
        .order('current_streak', { ascending: false })
        .order('longest_streak', { ascending: false })

      if (streaks) {
        const leaderboardData = streaks.map((s: any, index: number) => ({
          user_id: s.user_id,
          current_streak: s.current_streak || 0,
          longest_streak: s.longest_streak || 0,
          total_activities: s.total_activities || 0,
          last_activity_date: s.last_activity_date,
          display_name: s.user_profiles?.display_name || s.user_profiles?.email,
          email: s.user_profiles?.email,
          rank: index + 1,
        }))
        setLeaderboard(leaderboardData)
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getWeekColorIndex = (streak: number) => {
    return Math.floor(streak / 7) % WEEK_COLORS.length
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--company-primary)' }}></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div style={{ color: 'var(--company-primary)' }}>
          <Heading level={1} size="xl">
            Streak Leaderboard 🔥
          </Heading>
        </div>
        <Text variant="muted" className="mt-2">
          Top performers ranked by current streak
        </Text>
      </div>

      {/* Podium - Top 3 */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
          {/* 2nd Place */}
          <div className="flex flex-col items-center mt-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-gradient-to-br from-gray-300 to-gray-400 text-white mb-2">
              2
            </div>
            <Card variant="outlined" padding="md" className="w-full text-center">
              <Text className="font-bold truncate">{leaderboard[1].display_name}</Text>
              <div className="mt-2">
                <div style={{ color: 'var(--company-primary)' }}>
                  <Text className="text-2xl font-bold">
                    {leaderboard[1].current_streak}
                  </Text>
                </div>
                <Text size="sm" variant="muted">days</Text>
              </div>
            </Card>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold bg-gradient-to-br from-yellow-400 to-yellow-600 text-white mb-2 relative">
              <span className="absolute -top-6 text-4xl">👑</span>
              1
            </div>
            <div style={{ borderColor: 'var(--company-primary)' }} className="border-2 rounded-lg">
              <Card variant="outlined" padding="md" className="w-full text-center border-0">
                <Text className="font-bold truncate">{leaderboard[0].display_name}</Text>
                <div className="mt-2">
                  <div style={{ color: 'var(--company-primary)' }}>
                    <Text className="text-3xl font-bold">
                      {leaderboard[0].current_streak}
                    </Text>
                  </div>
                  <Text size="sm" variant="muted">days</Text>
                </div>
              </Card>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center mt-12">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold bg-gradient-to-br from-orange-300 to-orange-500 text-white mb-2">
              3
            </div>
            <Card variant="outlined" padding="md" className="w-full text-center">
              <Text className="font-bold truncate">{leaderboard[2].display_name}</Text>
              <div className="mt-2">
                <div style={{ color: 'var(--company-primary)' }}>
                  <Text className="text-xl font-bold">
                    {leaderboard[2].current_streak}
                  </Text>
                </div>
                <Text size="sm" variant="muted">days</Text>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Full Leaderboard */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <Heading level={2} size="lg" className="mb-6 text-gray-900">All Participants</Heading>

        {leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <Text variant="muted" className="text-gray-500">No streak data available yet</Text>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => {
              const weekColor = WEEK_COLORS[getWeekColorIndex(entry.current_streak)]

              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-all border ${
                    entry.rank <= 3 ? 'bg-gradient-to-r ' + weekColor + ' bg-opacity-10 border-gray-200' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Rank */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                        entry.rank === 1
                          ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
                          : entry.rank === 2
                          ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                          : entry.rank === 3
                          ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {entry.rank}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <Text className="font-semibold truncate text-gray-900">{entry.display_name}</Text>
                      <Text size="sm" variant="muted" className="truncate text-gray-500">{entry.email}</Text>
                      <Text size="sm" variant="muted" className="text-gray-500 text-xs">
                        Last activity: {formatDate(entry.last_activity_date)}
                      </Text>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-center">
                      <div style={{ color: 'var(--company-primary)' }}>
                        <Text className="text-2xl font-bold">
                          {entry.current_streak} 🔥
                        </Text>
                      </div>
                      <Text size="sm" variant="muted" className="text-gray-500">Current</Text>
                    </div>
                    <div className="text-center">
                      <Text className="text-lg font-semibold text-gray-600">
                        {entry.longest_streak}
                      </Text>
                      <Text size="sm" variant="muted" className="text-gray-500">Best</Text>
                    </div>
                    <div className="text-center">
                      <Text className="text-lg font-semibold text-gray-600">
                        {entry.total_activities}
                      </Text>
                      <Text size="sm" variant="muted" className="text-gray-500">Total</Text>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <Text size="sm" variant="muted" className="text-center text-gray-600">
          💡 Your streak color changes every week! Keep it going to unlock all 6 colors.
        </Text>
      </div>
    </div>
  )
}
