import { createClient } from '@/utils/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

// Helper to verify user authentication
async function verifyAuth(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { error: 'Profile not found', status: 404 }
  }

  return { user, profile }
}

// POST /api/chat/channels/[id]/archive - Archive channel for current user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Verify authentication
    const authCheck = await verifyAuth(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { user } = authCheck

    // Verify user is a member of this channel
    const { data: membership, error: membershipError } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('channel_id', id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Channel not found or access denied' }, { status: 404 })
    }

    // Archive the channel (soft delete for this user)
    const { error: archiveError } = await supabase
      .from('channel_archives')
      .insert({
        channel_id: id,
        user_id: user.id,
      })

    if (archiveError) {
      // If already archived, return success
      if (archiveError.code === '23505') { // Unique constraint violation
        return NextResponse.json({ success: true, message: 'Channel already archived' })
      }

      console.error('Error archiving channel:', archiveError)
      return NextResponse.json({ error: 'Failed to archive channel' }, { status: 500 })
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

// DELETE /api/chat/channels/[id]/archive - Unarchive channel
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Verify authentication
    const authCheck = await verifyAuth(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { user } = authCheck

    // Remove archive entry
    const { error: unarchiveError } = await supabase
      .from('channel_archives')
      .delete()
      .eq('channel_id', id)
      .eq('user_id', user.id)

    if (unarchiveError) {
      console.error('Error unarchiving channel:', unarchiveError)
      return NextResponse.json({ error: 'Failed to unarchive channel' }, { status: 500 })
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
