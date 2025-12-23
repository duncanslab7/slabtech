import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextRequest, NextResponse } from 'next/server'
import type { ObjectionType } from '@/utils/conversationAnalysis'

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

  if (profile?.role !== 'super_admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET playlist statistics for a user (counts per objection type)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const supabase = await createClient()

    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Use service role client to bypass RLS
    const serviceSupabase = createServiceRoleClient()

    // Verify user exists
    const { data: targetUser } = await serviceSupabase
      .from('user_profiles')
      .select('id, name')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get transcript IDs from both assignments AND subscriptions

    // 1. Get assigned transcript IDs
    const { data: assignments, error: assignmentsError } = await serviceSupabase
      .from('transcript_assignments')
      .select('transcript_id')
      .eq('user_id', userId)

    if (assignmentsError) {
      throw assignmentsError
    }

    const assignedIds = assignments?.map(a => a.transcript_id) || []

    // 2. Get subscribed salespeople
    const { data: subscriptions, error: subscriptionsError } = await serviceSupabase
      .from('salesperson_subscriptions')
      .select('salesperson_name')
      .eq('user_id', userId)

    if (subscriptionsError) {
      throw subscriptionsError
    }

    const salespersonNames = subscriptions?.map(s => s.salesperson_name) || []

    // 3. Get transcript IDs for subscribed salespeople
    let subscribedIds: string[] = []
    if (salespersonNames.length > 0) {
      const { data: subscribedTranscripts, error: subscribedError } = await serviceSupabase
        .from('transcripts')
        .select('id')
        .in('salesperson_name', salespersonNames)

      if (subscribedError) {
        throw subscribedError
      }

      subscribedIds = subscribedTranscripts?.map(t => t.id) || []
    }

    // 4. Combine both sets of transcript IDs (remove duplicates)
    const allTranscriptIds = Array.from(new Set([...assignedIds, ...subscribedIds]))

    // Fetch all conversations for this user to calculate statistics
    const { data: conversations, error } = await serviceSupabase
      .from('conversations')
      .select('objections')
      .in('transcript_id', allTranscriptIds)

    if (error) {
      throw error
    }

    // Count conversations per objection type
    const objectionCounts: Record<ObjectionType, number> = {
      diy: 0,
      spouse: 0,
      price: 0,
      competitor: 0,
      delay: 0,
      not_interested: 0,
      no_problem: 0,
      no_soliciting: 0
    }

    conversations?.forEach(conv => {
      const objections = conv.objections as ObjectionType[]
      objections?.forEach(objection => {
        if (objection in objectionCounts) {
          objectionCounts[objection]++
        }
      })
    })

    // Convert to array format for easier frontend consumption
    const playlists = Object.entries(objectionCounts)
      .filter(([_, count]) => count > 0) // Only include objections that exist
      .map(([objectionType, count]) => ({
        objectionType,
        conversationCount: count
      }))
      .sort((a, b) => b.conversationCount - a.conversationCount) // Sort by count descending

    return NextResponse.json({
      user: {
        id: targetUser.id,
        name: targetUser.name
      },
      totalConversations: conversations?.length || 0,
      playlists
    })
  } catch (error: any) {
    console.error('Error fetching playlist stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
