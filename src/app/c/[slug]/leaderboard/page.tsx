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
  profile_picture_url: string | null
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
      if (!user) {
        console.log('No user found')
        return
      }

      // Get user profile with company info
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      console.log('User profile:', profile, 'Error:', profileError)

      if (!profile || !profile.company_id) {
        console.log('No profile or company_id found')
        return
      }

      console.log('Fetching leaderboard for company_id:', profile.company_id)

      // Fetch all active users in the company with their streak data (if any)
      const { data: companyUsers, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, display_name, email, is_active, profile_picture_url')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)

      console.log('Company users:', companyUsers, 'Error:', usersError)

      if (!companyUsers || companyUsers.length === 0) {
        console.log('No users found in company')
        setLoading(false)
        return
      }

      // Get streak data for these users
      const userIds = companyUsers.map(u => u.id)
      const { data: streaks, error: streaksError } = await supabase
        .from('user_streaks')
        .select('user_id, current_streak, longest_streak, total_activities, last_activity_date')
        .in('user_id', userIds)

      console.log('Streaks data:', streaks, 'Error:', streaksError)

      // Merge user data with streak data
      const leaderboardData = companyUsers.map((user) => {
        const userStreak = streaks?.find(s => s.user_id === user.id)
        return {
          user_id: user.id,
          current_streak: userStreak?.current_streak || 0,
          longest_streak: userStreak?.longest_streak || 0,
          total_activities: userStreak?.total_activities || 0,
          last_activity_date: userStreak?.last_activity_date || null,
          display_name: user.display_name || user.email,
          email: user.email,
          profile_picture_url: user.profile_picture_url || null,
          rank: 0, // Will be set after sorting
        }
      })

      // Sort by current_streak (desc), then longest_streak (desc)
      leaderboardData.sort((a, b) => {
        if (b.current_streak !== a.current_streak) {
          return b.current_streak - a.current_streak
        }
        return b.longest_streak - a.longest_streak
      })

      // Assign ranks
      leaderboardData.forEach((entry, index) => {
        entry.rank = index + 1
      })

      console.log('Processed leaderboard data:', leaderboardData)
      setLeaderboard(leaderboardData)
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
            <div className="relative mb-2">
              {leaderboard[1].profile_picture_url ? (
                <img
                  src={leaderboard[1].profile_picture_url}
                  alt={leaderboard[1].display_name}
                  className="w-20 h-20 rounded-full object-cover border-4"
                  style={{ borderColor: 'var(--company-secondary)' }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl border-4"
                  style={{
                    background: 'linear-gradient(135deg, var(--company-primary) 0%, var(--company-secondary) 100%)',
                    borderColor: 'var(--company-secondary)'
                  }}
                >
                  {leaderboard[1].display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-gray-300 to-gray-400 text-white border-2 border-white">
                2
              </div>
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
            <div className="relative mb-2">
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-4xl">👑</span>
              {leaderboard[0].profile_picture_url ? (
                <img
                  src={leaderboard[0].profile_picture_url}
                  alt={leaderboard[0].display_name}
                  className="w-24 h-24 rounded-full object-cover border-4"
                  style={{ borderColor: 'var(--company-secondary)' }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl border-4"
                  style={{
                    background: 'linear-gradient(135deg, var(--company-primary) 0%, var(--company-secondary) 100%)',
                    borderColor: 'var(--company-secondary)'
                  }}
                >
                  {leaderboard[0].display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-gradient-to-br from-yellow-400 to-yellow-600 text-white border-2 border-white">
                1
              </div>
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
            <div className="relative mb-2">
              {leaderboard[2].profile_picture_url ? (
                <img
                  src={leaderboard[2].profile_picture_url}
                  alt={leaderboard[2].display_name}
                  className="w-16 h-16 rounded-full object-cover border-4"
                  style={{ borderColor: 'var(--company-secondary)' }}
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl border-4"
                  style={{
                    background: 'linear-gradient(135deg, var(--company-primary) 0%, var(--company-secondary) 100%)',
                    borderColor: 'var(--company-secondary)'
                  }}
                >
                  {leaderboard[2].display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-orange-300 to-orange-500 text-white border-2 border-white">
                3
              </div>
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
              return (
                <div
                  key={entry.user_id}
                  className="flex items-center justify-between p-4 rounded-lg transition-all border border-gray-200 relative overflow-hidden"
                  style={{
                    background: `linear-gradient(90deg, var(--company-primary) 0%, var(--company-primary) 100%)`,
                    backgroundImage: `
                      linear-gradient(90deg, var(--company-primary) 0%, var(--company-primary) 100%),
                      url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")
                    `
                  }}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Rank */}
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 border-2"
                      style={{
                        background: 'linear-gradient(135deg, var(--company-primary) 0%, var(--company-secondary) 100%)',
                        borderColor: 'var(--company-secondary)',
                        color: 'var(--company-secondary)'
                      }}
                    >
                      <span className="text-white">{entry.rank}</span>
                    </div>

                    {/* Profile Picture */}
                    <div className="relative flex-shrink-0">
                      {entry.profile_picture_url ? (
                        <img
                          src={entry.profile_picture_url}
                          alt={entry.display_name}
                          className="w-12 h-12 rounded-full object-cover border-2"
                          style={{ borderColor: 'var(--company-secondary)' }}
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg border-2"
                          style={{
                            background: 'linear-gradient(135deg, var(--company-primary) 0%, var(--company-secondary) 100%)',
                            borderColor: 'var(--company-secondary)'
                          }}
                        >
                          {entry.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <Text className="font-semibold truncate" style={{ color: 'var(--company-secondary)' }}>{entry.display_name}</Text>
                      <Text size="sm" className="text-xs" style={{ color: 'var(--company-secondary)', opacity: 0.8 }}>
                        Last activity: {formatDate(entry.last_activity_date)}
                      </Text>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-8 flex-shrink-0">
                    <div className="text-center">
                      <div style={{ color: 'var(--company-secondary)' }}>
                        <div className="text-4xl font-bold">
                          {entry.current_streak} 🔥
                        </div>
                      </div>
                      <Text size="sm" className="text-xs font-medium" style={{ color: 'var(--company-secondary)', opacity: 0.8 }}>Current</Text>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold" style={{ color: 'var(--company-secondary)' }}>
                        {entry.longest_streak}
                      </div>
                      <Text size="sm" className="text-xs" style={{ color: 'var(--company-secondary)', opacity: 0.7 }}>Best</Text>
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
