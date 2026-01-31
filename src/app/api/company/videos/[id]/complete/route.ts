import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/company/videos/[id]/complete - Mark video as complete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { id: videoId } = await params

    // Verify video exists and belongs to user's company
    const { data: video, error: videoError } = await supabase
      .from('training_videos')
      .select('company_id')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (video.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Mark video as complete (upsert to handle re-completion)
    const { data: completion, error: insertError } = await supabase
      .from('video_completions')
      .upsert({
        user_id: user.id,
        video_id: videoId,
        company_id: profile.company_id,
        completed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,video_id'
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, completion })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/company/videos/[id]/complete - Unmark video as complete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: videoId } = await params

    // Delete completion record
    const { error: deleteError } = await supabase
      .from('video_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('video_id', videoId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/company/videos/[id]/complete - Get completion stats for a video (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is company admin or super admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { id: videoId } = await params

    // Verify video belongs to user's company
    const { data: video, error: videoError } = await supabase
      .from('training_videos')
      .select('company_id')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (profile.role !== 'super_admin' && video.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all completions for this video
    const { data: completions, error: completionsError } = await supabase
      .from('video_completions')
      .select(`
        *,
        user_profiles (
          id,
          email,
          display_name
        )
      `)
      .eq('video_id', videoId)
      .order('completed_at', { ascending: false })

    if (completionsError) {
      return NextResponse.json({ error: completionsError.message }, { status: 500 })
    }

    // Get total users in company for completion percentage
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', video.company_id)
      .eq('is_active', true)

    return NextResponse.json({
      completions,
      total_users: totalUsers || 0,
      completion_count: completions?.length || 0,
      completion_percentage: totalUsers ? ((completions?.length || 0) / totalUsers * 100).toFixed(1) : 0
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
