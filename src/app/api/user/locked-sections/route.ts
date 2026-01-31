import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/user/locked-sections - Check which sections are locked for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the helper function to get blocking videos
    const { data: blockingVideos, error: blockingError } = await supabase
      .rpc('get_user_blocking_videos', { p_user_id: user.id })

    if (blockingError) {
      console.error('Error getting blocking videos:', blockingError)
      return NextResponse.json({ error: blockingError.message }, { status: 500 })
    }

    // Determine which sections are locked
    const transcriptsLocked = blockingVideos?.some(
      (v: any) => v.blocks_transcripts && !v.has_passed
    ) || false

    const trainingPlaylistsLocked = blockingVideos?.some(
      (v: any) => v.blocks_training_playlists && !v.has_passed
    ) || false

    // Get the specific blocking videos for each section
    const transcriptBlockers = blockingVideos?.filter(
      (v: any) => v.blocks_transcripts && !v.has_passed
    ) || []

    const trainingPlaylistBlockers = blockingVideos?.filter(
      (v: any) => v.blocks_training_playlists && !v.has_passed
    ) || []

    return NextResponse.json({
      transcripts: {
        locked: transcriptsLocked,
        blockingVideos: transcriptBlockers
      },
      trainingPlaylists: {
        locked: trainingPlaylistsLocked,
        blockingVideos: trainingPlaylistBlockers
      }
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
