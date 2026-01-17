import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    // Get current user (for auth check)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the company from the slug
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('slug', slug)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Get all active users in the company
    const { data: companyUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, display_name, email, is_active, profile_picture_url, company_id')
      .eq('company_id', company.id)
      .eq('is_active', true)

    if (usersError) {
      console.error('Error fetching company users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    if (!companyUsers || companyUsers.length === 0) {
      return NextResponse.json([])
    }

    // Get streak data for these users
    const userIds = companyUsers.map((u) => u.id)
    const { data: streaks, error: streaksError } = await supabase
      .from('user_streaks')
      .select('user_id, current_streak, longest_streak, total_activities, last_activity_date')
      .in('user_id', userIds)

    if (streaksError) {
      console.error('Error fetching streaks:', streaksError)
      return NextResponse.json({ error: 'Failed to fetch streaks' }, { status: 500 })
    }

    // Merge user data with streak data
    const leaderboardData = companyUsers.map((user) => {
      const userStreak = streaks?.find((s) => s.user_id === user.id)
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

    return NextResponse.json(leaderboardData)
  } catch (error) {
    console.error('Unexpected error in GET /api/company/[slug]/leaderboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
