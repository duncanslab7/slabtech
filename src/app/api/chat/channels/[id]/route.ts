import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
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

// GET /api/chat/channels/[id] - Get channel details
export async function GET(
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

    // Fetch channel with members (RLS will ensure user has access)
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select(`
        id,
        channel_type,
        name,
        description,
        picture_url,
        created_by,
        created_at,
        updated_at,
        company_id,
        channel_members(
          user_id,
          is_active,
          joined_at,
          added_by,
          user_profiles!channel_members_user_id_fkey(id, display_name, profile_picture_url, email)
        )
      `)
      .eq('id', id)
      .single()

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Get message count
    const { count: messageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', id)

    // Get user's membership info
    const userMembership = channel.channel_members.find((m: any) => m.user_id === user.id)

    return NextResponse.json({
      channel: {
        ...channel,
        message_count: messageCount || 0,
        user_membership: userMembership,
      }
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// PATCH /api/chat/channels/[id] - Update group channel
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

    const { user, profile } = authCheck

    const body = await request.json()
    const { name, description, picture_url } = body

    // Verify channel exists and user has permission (creator or company admin)
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, channel_type, created_by, company_id')
      .eq('id', id)
      .single()

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Only groups can be updated
    if (channel.channel_type !== 'group') {
      return NextResponse.json({ error: 'Only group channels can be updated' }, { status: 400 })
    }

    // Check permission (creator or company admin)
    const isCreator = channel.created_by === user.id
    const isCompanyAdmin = ['company_admin', 'super_admin'].includes(profile.role) &&
                          channel.company_id === profile.company_id

    if (!isCreator && !isCompanyAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build update object
    const updates: any = {}
    if (name !== undefined && name.trim().length > 0) {
      updates.name = name.trim()
    }
    if (description !== undefined) {
      updates.description = description?.trim() || null
    }
    if (picture_url !== undefined) {
      updates.picture_url = picture_url
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    // Update channel
    const { data: updatedChannel, error: updateError } = await supabase
      .from('channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating channel:', updateError)
      return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 })
    }

    return NextResponse.json({ channel: updatedChannel })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE /api/chat/channels/[id] - Delete channel (super admin only)
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

    const { profile } = authCheck

    // Only super admins can delete channels
    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use service role to delete (bypass RLS)
    const serviceSupabase = createServiceRoleClient()
    const { error: deleteError } = await serviceSupabase
      .from('channels')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting channel:', deleteError)
      return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 })
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
