import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/company/training-videos - List all videos for user's company
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to find company
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Fetch videos with completion status (RLS will handle company scoping)
    const { data: videos, error } = await supabase
      .from('training_videos')
      .select(`
        *,
        video_completions(user_id, completed_at)
      `)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching videos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter completions to only show current user's completions
    const videosWithUserCompletions = videos?.map(video => ({
      ...video,
      video_completions: video.video_completions?.filter((c: any) => c.user_id === user.id) || []
    }))

    return NextResponse.json({ videos: videosWithUserCompletions })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/company/training-videos - Create new video (company admin only)
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const {
      title,
      description,
      video_type,
      youtube_url,
      storage_path,
      thumbnail_url,
      duration
    } = body

    if (!title || !video_type) {
      return NextResponse.json({
        error: 'Title and video_type are required'
      }, { status: 400 })
    }

    if (video_type === 'youtube' && !youtube_url) {
      return NextResponse.json({
        error: 'youtube_url is required for YouTube videos'
      }, { status: 400 })
    }

    if (video_type === 'upload' && !storage_path) {
      return NextResponse.json({
        error: 'storage_path is required for uploaded videos'
      }, { status: 400 })
    }

    // Create video record
    const { data: video, error: insertError } = await supabase
      .from('training_videos')
      .insert({
        company_id: profile.company_id,
        title,
        description,
        video_type,
        youtube_url: video_type === 'youtube' ? youtube_url : null,
        storage_path: video_type === 'upload' ? storage_path : null,
        thumbnail_url,
        duration,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating video:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log('Video created successfully:', video)
    return NextResponse.json({ success: true, video })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
