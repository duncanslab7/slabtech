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

// POST /api/chat/channels/[id]/members - Add members to group
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

    const { user, profile } = authCheck

    const body = await request.json()
    const { userIds } = body

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'User IDs array is required' }, { status: 400 })
    }

    // Fetch channel and verify permissions
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, channel_type, created_by, company_id')
      .eq('id', id)
      .single()

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Only groups can have members added
    if (channel.channel_type !== 'group') {
      return NextResponse.json({ error: 'Can only add members to group channels' }, { status: 400 })
    }

    // Check permission (creator or company admin)
    const isCreator = channel.created_by === user.id
    const isCompanyAdmin = ['company_admin', 'super_admin'].includes(profile.role) &&
                          channel.company_id === profile.company_id

    if (!isCreator && !isCompanyAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify all users are in the same company
    const { data: validUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('company_id', profile.company_id)
      .in('id', userIds)

    if (usersError || !validUsers || validUsers.length !== userIds.length) {
      return NextResponse.json({ error: 'Some users not found in your company' }, { status: 400 })
    }

    // Check which users are already members
    const { data: existingMembers } = await supabase
      .from('channel_members')
      .select('user_id, is_active')
      .eq('channel_id', id)
      .in('user_id', userIds)

    const existingMemberMap = new Map(
      (existingMembers || []).map((m: any) => [m.user_id, m.is_active])
    )

    // Prepare members to add
    const membersToAdd = []
    const membersToReactivate = []

    for (const userId of userIds) {
      const isActive = existingMemberMap.get(userId)

      if (isActive === undefined) {
        // New member
        membersToAdd.push({
          channel_id: id,
          user_id: userId,
          added_by: user.id,
        })
      } else if (isActive === false) {
        // Reactivate inactive member
        membersToReactivate.push(userId)
      }
      // If isActive === true, member already active, skip
    }

    // Insert new members
    if (membersToAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('channel_members')
        .insert(membersToAdd)

      if (insertError) {
        console.error('Error adding members:', insertError)
        return NextResponse.json({ error: 'Failed to add members' }, { status: 500 })
      }
    }

    // Reactivate inactive members
    if (membersToReactivate.length > 0) {
      const { error: updateError } = await supabase
        .from('channel_members')
        .update({
          is_active: true,
          left_at: null,
          removed_by: null,
          added_by: user.id,
          joined_at: new Date().toISOString(),
        })
        .eq('channel_id', id)
        .in('user_id', membersToReactivate)

      if (updateError) {
        console.error('Error reactivating members:', updateError)
        return NextResponse.json({ error: 'Failed to reactivate members' }, { status: 500 })
      }
    }

    // Fetch updated members list
    const { data: members, error: membersError } = await supabase
      .from('channel_members')
      .select('user_id, user_profiles!channel_members_user_id_fkey(id, display_name, profile_picture_url)')
      .eq('channel_id', id)
      .eq('is_active', true)

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      members: members.map((m: any) => m.user_profiles),
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
