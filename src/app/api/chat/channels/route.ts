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

// GET /api/chat/channels - List user's channels
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const authCheck = await verifyAuth(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { user, profile } = authCheck

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const archived = searchParams.get('archived') === 'true'

    // Build query for channels (RLS handles filtering to user's active memberships)
    let channelsQuery = supabase
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
        channel_members(
          user_id,
          is_active,
          last_read_at,
          user_profiles!channel_members_user_id_fkey(id, display_name, profile_picture_url)
        )
      `)
      .eq('company_id', profile.company_id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter archived/active based on query param
    if (!archived) {
      // Exclude archived channels - RLS already handles this via policy
    }

    const { data: channels, error: channelsError } = await channelsQuery

    if (channelsError) {
      console.error('Error fetching channels:', channelsError)
      return NextResponse.json({
        error: 'Failed to fetch channels',
        details: channelsError.message || channelsError
      }, { status: 500 })
    }

    // For each channel, fetch last message and unread count
    const enrichedChannels = await Promise.all(
      (channels || []).map(async (channel: any) => {
        // Get last message
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('id, message_text, created_at, user_id, user_profiles(display_name)')
          .eq('channel_id', channel.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Get user's membership info for last_read_at
        const userMembership = channel.channel_members.find((m: any) => m.user_id === user.id)

        // Count unread messages (exclude own messages)
        let unreadCount = 0
        if (userMembership?.last_read_at) {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', channel.id)
            .gt('created_at', userMembership.last_read_at)
            .neq('user_id', user.id) // Don't count own messages as unread

          unreadCount = count || 0
        }

        // Get other members (for DM display name)
        const otherMembers = channel.channel_members
          .filter((m: any) => m.user_id !== user.id)
          .map((m: any) => m.user_profiles)

        return {
          id: channel.id,
          channel_type: channel.channel_type,
          name: channel.channel_type === 'dm'
            ? otherMembers[0]?.display_name || 'Unknown User'
            : channel.name,
          description: channel.description,
          picture_url: channel.channel_type === 'dm'
            ? otherMembers[0]?.profile_picture_url
            : channel.picture_url,
          created_by: channel.created_by,
          created_at: channel.created_at,
          updated_at: channel.updated_at,
          last_message: lastMessage,
          unread_count: unreadCount,
          members: channel.channel_members.map((m: any) => m.user_profiles),
          other_members: otherMembers,
        }
      })
    )

    return NextResponse.json({ data: { channels: enrichedChannels } })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST /api/chat/channels - Create new DM or group channel
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const authCheck = await verifyAuth(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { user, profile } = authCheck

    const body = await request.json()
    const { type, targetUserId, name, description, memberIds } = body

    // Validate channel type
    if (!['dm', 'group'].includes(type)) {
      return NextResponse.json({ error: 'Invalid channel type' }, { status: 400 })
    }

    // Validate group requirements
    if (type === 'group' && (!name || name.trim().length === 0)) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    // Validate DM requirements
    if (type === 'dm' && !targetUserId) {
      return NextResponse.json({ error: 'Target user ID is required for DM' }, { status: 400 })
    }

    // For DM: use helper function to get or create
    if (type === 'dm') {
      // Verify target user exists and is in same company
      const { data: targetUser, error: targetError } = await supabase
        .from('user_profiles')
        .select('id, company_id')
        .eq('id', targetUserId)
        .eq('company_id', profile.company_id)
        .single()

      if (targetError || !targetUser) {
        return NextResponse.json({ error: 'Target user not found in your company' }, { status: 404 })
      }

      // Call helper function to get or create DM channel
      const { data: channelIdData, error: channelError } = await supabase
        .rpc('get_or_create_dm_channel', {
          p_company_id: profile.company_id,
          p_user1_id: user.id,
          p_user2_id: targetUserId,
        })

      if (channelError) {
        console.error('Error creating DM channel:', channelError)
        return NextResponse.json({
          error: 'Failed to create DM channel',
          details: channelError.message || channelError
        }, { status: 500 })
      }

      // Fetch the created/existing channel
      const { data: channel, error: fetchError } = await supabase
        .from('channels')
        .select(`
          id,
          channel_type,
          created_by,
          created_at,
          updated_at,
          channel_members(
            user_id,
            user_profiles!channel_members_user_id_fkey(id, display_name, profile_picture_url)
          )
        `)
        .eq('id', channelIdData)
        .single()

      if (fetchError) {
        console.error('Error fetching channel:', fetchError)
        return NextResponse.json({
          error: 'Failed to fetch channel',
          details: fetchError.message || fetchError
        }, { status: 500 })
      }

      return NextResponse.json({ channel })
    }

    // For group: create channel and add members
    if (type === 'group') {
      // Create the group channel
      const { data: channel, error: createError } = await supabase
        .from('channels')
        .insert({
          company_id: profile.company_id,
          channel_type: 'group',
          name: name.trim(),
          description: description?.trim(),
          created_by: user.id,
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating group channel:', createError)
        return NextResponse.json({ error: 'Failed to create group channel' }, { status: 500 })
      }

      // Add creator as member
      const membersToAdd = [
        {
          channel_id: channel.id,
          user_id: user.id,
          added_by: user.id,
        }
      ]

      // Add other members if provided
      if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
        // Verify all members are in same company
        const { data: validUsers, error: usersError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('company_id', profile.company_id)
          .in('id', memberIds)

        if (usersError || !validUsers || validUsers.length !== memberIds.length) {
          // Rollback - delete the channel
          await supabase.from('channels').delete().eq('id', channel.id)
          return NextResponse.json({ error: 'Some users not found in your company' }, { status: 400 })
        }

        memberIds.forEach((memberId: string) => {
          if (memberId !== user.id) {
            membersToAdd.push({
              channel_id: channel.id,
              user_id: memberId,
              added_by: user.id,
            })
          }
        })
      }

      // Insert all members
      const { error: membersError } = await supabase
        .from('channel_members')
        .insert(membersToAdd)

      if (membersError) {
        console.error('Error adding members:', membersError)
        // Rollback - delete the channel
        await supabase.from('channels').delete().eq('id', channel.id)
        return NextResponse.json({ error: 'Failed to add members' }, { status: 500 })
      }

      // Fetch complete channel with members
      const { data: completeChannel, error: fetchError } = await supabase
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
          channel_members(
            user_id,
            user_profiles!channel_members_user_id_fkey(id, display_name, profile_picture_url)
          )
        `)
        .eq('id', channel.id)
        .single()

      if (fetchError) {
        console.error('Error fetching channel:', fetchError)
        return NextResponse.json({
          error: 'Failed to fetch channel',
          details: fetchError.message || fetchError
        }, { status: 500 })
      }

      return NextResponse.json({ channel: completeChannel })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
