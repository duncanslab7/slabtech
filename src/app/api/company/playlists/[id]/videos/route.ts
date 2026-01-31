import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/company/playlists/[id]/videos - Add video to playlist (company admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const playlistId = params.id
    const body = await request.json()
    const { video_id, position } = body

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 })
    }

    // Verify playlist belongs to user's company
    const { data: playlist, error: playlistError } = await supabase
      .from('training_playlists')
      .select('company_id')
      .eq('id', playlistId)
      .single()

    if (playlistError || !playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    if (profile.role !== 'super_admin' && playlist.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify video exists and belongs to same company
    const { data: video, error: videoError } = await supabase
      .from('training_videos')
      .select('company_id')
      .eq('id', video_id)
      .single()

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (video.company_id !== playlist.company_id) {
      return NextResponse.json({
        error: 'Video and playlist must be from the same company'
      }, { status: 400 })
    }

    // Get current max position if no position provided
    let finalPosition = position
    if (finalPosition === undefined) {
      const { data: maxPos } = await supabase
        .from('playlist_videos')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1)
        .single()

      finalPosition = maxPos ? maxPos.position + 1 : 0
    }

    // Add video to playlist
    const { data: playlistVideo, error: insertError } = await supabase
      .from('playlist_videos')
      .insert({
        playlist_id: playlistId,
        video_id,
        position: finalPosition,
      })
      .select()
      .single()

    if (insertError) {
      // Handle duplicate video in playlist
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: 'Video already in playlist'
        }, { status: 400 })
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, playlistVideo })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/company/playlists/[id]/videos?video_id=xxx - Remove video from playlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const playlistId = params.id
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('video_id')

    if (!videoId) {
      return NextResponse.json({ error: 'video_id query parameter is required' }, { status: 400 })
    }

    // Verify playlist belongs to user's company
    const { data: playlist, error: playlistError } = await supabase
      .from('training_playlists')
      .select('company_id')
      .eq('id', playlistId)
      .single()

    if (playlistError || !playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    if (profile.role !== 'super_admin' && playlist.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Remove video from playlist
    const { error: deleteError } = await supabase
      .from('playlist_videos')
      .delete()
      .eq('playlist_id', playlistId)
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
