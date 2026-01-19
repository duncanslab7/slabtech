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

// PATCH /api/chat/channels/[id]/read - Mark channel as read
export async function PATCH(
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

    const body = await request.json()
    const { messageId } = body

    // Verify user is a member of this channel
    const { data: membership, error: membershipError } = await supabase
      .from('channel_members')
      .select('is_active')
      .eq('channel_id', id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership || !membership.is_active) {
      return NextResponse.json({ error: 'Channel not found or access denied' }, { status: 404 })
    }

    // Update last_read_at and optionally last_read_message_id
    const updateData: any = {
      last_read_at: new Date().toISOString(),
    }

    if (messageId) {
      // Verify message exists in this channel
      const { data: message, error: messageError } = await supabase
        .from('chat_messages')
        .select('id, channel_id')
        .eq('id', messageId)
        .eq('channel_id', id)
        .single()

      if (messageError || !message) {
        return NextResponse.json({ error: 'Message not found in this channel' }, { status: 404 })
      }

      updateData.last_read_message_id = messageId
    }

    // Update membership
    const { error: updateError } = await supabase
      .from('channel_members')
      .update(updateData)
      .eq('channel_id', id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating read status:', updateError)
      return NextResponse.json({ error: 'Failed to update read status' }, { status: 500 })
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
