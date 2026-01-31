import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/company/training-videos/[id] - Delete video (company admin only)
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

    // Get video to check company and storage path
    const { data: video, error: fetchError } = await supabase
      .from('training_videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Verify video belongs to user's company (unless super admin)
    if (profile.role !== 'super_admin' && video.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete from storage if it's an uploaded video
    if (video.video_type === 'upload' && video.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('training-videos')
        .remove([video.storage_path])

      if (storageError) {
        console.error('Failed to delete video from storage:', storageError)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete video record (this will cascade delete playlist_videos and video_completions)
    const { error: deleteError } = await supabase
      .from('training_videos')
      .delete()
      .eq('id', videoId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/company/training-videos/[id] - Update video (company admin only)
export async function PATCH(
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
    const body = await request.json()
    const { title, description, thumbnail_url, duration } = body

    // Get video to verify ownership
    const { data: video, error: fetchError } = await supabase
      .from('training_videos')
      .select('company_id')
      .eq('id', videoId)
      .single()

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Verify video belongs to user's company (unless super admin)
    if (profile.role !== 'super_admin' && video.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update video
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url
    if (duration !== undefined) updateData.duration = duration

    const { data: updatedVideo, error: updateError } = await supabase
      .from('training_videos')
      .update(updateData)
      .eq('id', videoId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, video: updatedVideo })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
