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

// DELETE /api/chat/channels/[id]/members/[userId] - Remove member or leave channel
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { id, userId } = await params

    // Verify authentication
    const authCheck = await verifyAuth(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { user, profile } = authCheck

    // Fetch channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, channel_type, created_by, company_id')
      .eq('id', id)
      .single()

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Check if user is removing themselves (leaving) or someone else (kicking)
    const isSelf = userId === user.id
    const isKicking = !isSelf

    // For DMs, users can only leave (archive), not actually remove membership
    if (channel.channel_type === 'dm' && isSelf) {
      // For DMs, user should archive instead
      return NextResponse.json({
        error: 'Use archive endpoint for DMs. DM memberships cannot be removed.'
      }, { status: 400 })
    }

    // For groups: anyone can leave, only creator/admin can kick others
    if (isKicking) {
      // Check permission to kick (creator or company admin in groups they're members of)
      const isCreator = channel.created_by === user.id
      const isCompanyAdmin = ['company_admin', 'super_admin'].includes(profile.role) &&
                            channel.company_id === profile.company_id

      if (!isCompanyAdmin && !isCreator) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Company admins can only kick from groups they're members of
      if (isCompanyAdmin && !isCreator) {
        const { data: adminMembership } = await supabase
          .from('channel_members')
          .select('user_id')
          .eq('channel_id', id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()

        if (!adminMembership) {
          return NextResponse.json({
            error: 'Company admins can only kick from groups they are members of'
          }, { status: 403 })
        }
      }
    }

    // Verify target user is a member
    const { data: membership, error: membershipError } = await supabase
      .from('channel_members')
      .select('id, is_active')
      .eq('channel_id', id)
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'User is not a member of this channel' }, { status: 404 })
    }

    if (!membership.is_active) {
      return NextResponse.json({ error: 'User is already inactive in this channel' }, { status: 400 })
    }

    // Update membership to inactive
    const updateData: any = {
      is_active: false,
      left_at: new Date().toISOString(),
    }

    if (isKicking) {
      updateData.removed_by = user.id
    }

    const { error: updateError } = await supabase
      .from('channel_members')
      .update(updateData)
      .eq('channel_id', id)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error removing member:', updateError)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: isSelf ? 'left' : 'removed',
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
