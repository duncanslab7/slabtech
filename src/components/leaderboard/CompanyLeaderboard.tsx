'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { StreakCounter } from '@/components/StreakCounter'

interface LeaderboardEntry {
  user_id: string
  display_name: string
  email: string
  current_streak: number
  longest_streak: number
  total_activities: number
  company_rank: number
}

export function CompanyLeaderboard({ companyId }: { companyId: string }) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('company_streak_leaderboard')
          .select('*')
          .eq('company_id', companyId)
          .limit(10)

        if (fetchError) {
          throw fetchError
        }

        if (data) {
          setLeaders(data as LeaderboardEntry[])
        }
      } catch (err) {
        console.error('Failed to load leaderboard:', err)
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
      } finally {
        setLoading(false)
      }
    }

    loadLeaderboard()
  }, [companyId])

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-company-primary mb-6">Streak Leaderboard 🔥</h2>
        <div className="text-center text-gray-400 py-8">Loading leaderboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-company-primary mb-6">Streak Leaderboard 🔥</h2>
        <div className="text-center text-red-400 py-8">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-company-primary mb-6">Streak Leaderboard 🔥</h2>

      {leaders.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No active streaks yet. Be the first to start one!
        </div>
      ) : (
        <div className="space-y-4">
          {leaders.map((entry, index) => {
            const isTopThree = index < 3
            const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null

            return (
              <div
                key={entry.user_id}
                className={`flex items-center justify-between bg-gray-800 rounded-lg p-4 transition-all ${
                  isTopThree ? 'border-2' : ''
                }`}
                style={
                  isTopThree
                    ? {
                        borderColor:
                          index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
                      }
                    : {}
                }
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="text-2xl font-bold text-gray-500 w-12 text-center">
                    {medalEmoji || `#${index + 1}`}
                  </div>

                  {/* User Info */}
                  <div>
                    <div className="font-semibold text-white">{entry.display_name || entry.email}</div>
                    <div className="text-sm text-gray-400">
                      Longest: {entry.longest_streak} days • Total: {entry.total_activities} activities
                    </div>
                  </div>
                </div>

                {/* Streak Counter */}
                <div className="flex items-center gap-2">
                  <StreakCounter streak={entry.current_streak} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Keep your streak alive by listening to audio every day!
      </div>
    </div>
  )
}
