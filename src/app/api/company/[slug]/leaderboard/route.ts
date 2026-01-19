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

    // Use the unified company_streak_leaderboard view
    // This view includes ALL active users and automatically ranks them
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('company_streak_leaderboard')
      .select('*')
      .eq('company_id', company.id)
      .order('company_rank', { ascending: true })

    if (leaderboardError) {
      console.error('Error fetching leaderboard:', leaderboardError)
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
    }

    if (!leaderboardData || leaderboardData.length === 0) {
      return NextResponse.json([])
    }

    // Format the data for the frontend (rename company_rank to rank)
    const formattedData = leaderboardData.map((entry) => ({
      user_id: entry.user_id,
      current_streak: entry.current_streak,
      longest_streak: entry.longest_streak,
      total_activities: entry.total_activities,
      last_activity_date: entry.last_activity_date,
      display_name: entry.display_name || entry.email,
      email: entry.email,
      profile_picture_url: entry.profile_picture_url || null,
      rank: entry.company_rank,
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Unexpected error in GET /api/company/[slug]/leaderboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
