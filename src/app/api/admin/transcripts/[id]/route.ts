import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

// Helper to verify admin access
async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// DELETE /api/admin/transcripts/[id] - Delete a transcript
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Get transcript to find audio files
    const { data: transcript, error: fetchError } = await supabase
      .from('transcripts')
      .select('file_storage_path, transcript_redacted')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching transcript:', fetchError)
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    // Delete audio files from storage
    const filesToDelete = []

    // Original audio file
    if (transcript.file_storage_path) {
      filesToDelete.push(transcript.file_storage_path)
    }

    // Redacted audio file
    const redactedPath = (transcript.transcript_redacted as any)?.redacted_file_storage_path
    if (redactedPath) {
      filesToDelete.push(redactedPath)
    }

    // Delete files from storage (don't fail if files don't exist)
    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('call-recordings')
        .remove(filesToDelete)

      if (storageError) {
        console.error('Error deleting audio files:', storageError)
        // Continue anyway - files might already be deleted
      }
    }

    // Delete transcript from database
    const { error: deleteError } = await supabase
      .from('transcripts')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting transcript:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete transcript' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
