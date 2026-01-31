import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/company/playlists/[id] - Get playlist with videos
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const playlistId = params.id

    // Fetch playlist (RLS will handle company scoping)
    const { data: playlist, error: playlistError } = await supabase
      .from('training_playlists')
      .select('*')
      .eq('id', playlistId)
      .single()

    if (playlistError || !playlist) {
      console.error('Error fetching playlist:', playlistError)
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    // Fetch videos in playlist with completion status
    const { data: playlistVideos, error: videosError } = await supabase
      .from('playlist_videos')
      .select(`
        position,
        training_videos (
          *,
          video_completions (
            user_id,
            completed_at
          )
        )
      `)
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true })

    if (videosError) {
      return NextResponse.json({ error: videosError.message }, { status: 500 })
    }

    return NextResponse.json({
      playlist,
      videos: playlistVideos?.map(pv => ({
        ...pv.training_videos,
        position: pv.position
      })) || []
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/company/playlists/[id] - Update playlist (company admin only)
export async function PATCH(
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
    const { name, description } = body

    // Get playlist to verify ownership
    const { data: playlist, error: fetchError } = await supabase
      .from('training_playlists')
      .select('company_id')
      .eq('id', playlistId)
      .single()

    if (fetchError || !playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    // Verify playlist belongs to user's company (unless super admin)
    if (profile.role !== 'super_admin' && playlist.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update playlist
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description

    const { data: updatedPlaylist, error: updateError } = await supabase
      .from('training_playlists')
      .update(updateData)
      .eq('id', playlistId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, playlist: updatedPlaylist })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/company/playlists/[id] - Delete playlist (company admin only)
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

    // Get playlist to verify ownership
    const { data: playlist, error: fetchError } = await supabase
      .from('training_playlists')
      .select('company_id')
      .eq('id', playlistId)
      .single()

    if (fetchError || !playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    // Verify playlist belongs to user's company (unless super admin)
    if (profile.role !== 'super_admin' && playlist.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete playlist (this will cascade delete playlist_videos)
    const { error: deleteError } = await supabase
      .from('training_playlists')
      .delete()
      .eq('id', playlistId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
