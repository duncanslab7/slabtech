import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { ObjectionType } from '@/utils/conversationAnalysis'

// GET playlist statistics for current user (counts per objection type)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get transcript IDs from both assignments AND subscriptions

    // 1. Get assigned transcript IDs
    const { data: assignments, error: assignmentsError } = await supabase
      .from('transcript_assignments')
      .select('transcript_id')
      .eq('user_id', user.id)

    if (assignmentsError) {
      throw assignmentsError
    }

    const assignedIds = assignments?.map(a => a.transcript_id) || []

    // 2. Get subscribed salespeople
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('salesperson_subscriptions')
      .select('salesperson_name')
      .eq('user_id', user.id)

    if (subscriptionsError) {
      throw subscriptionsError
    }

    const salespersonNames = subscriptions?.map(s => s.salesperson_name) || []

    // 3. Get transcript IDs for subscribed salespeople
    let subscribedIds: string[] = []
    if (salespersonNames.length > 0) {
      const { data: subscribedTranscripts, error: subscribedError } = await supabase
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

    if (allTranscriptIds.length === 0) {
      return NextResponse.json({
        totalConversations: 0,
        playlists: []
      })
    }

    // Fetch all conversations for this user to calculate statistics
    // Use the same join as the detail endpoint to ensure counts match
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        id,
        objections,
        transcripts!inner (
          id
        )
      `)
      .in('transcript_id', allTranscriptIds)

    if (error) {
      throw error
    }

    // Count unique conversations per objection type
    // Use Set to track which conversations have each objection (count each conversation only once)
    const objectionConversations: Record<ObjectionType, Set<string>> = {
      diy: new Set(),
      spouse: new Set(),
      price: new Set(),
      competitor: new Set(),
      delay: new Set(),
      not_interested: new Set(),
      no_problem: new Set(),
      no_soliciting: new Set()
    }

    conversations?.forEach(conv => {
      const objections = conv.objections as ObjectionType[]
      objections?.forEach(objection => {
        if (objection in objectionConversations) {
          objectionConversations[objection].add(conv.id)
        }
      })
    })

    // Convert Sets to counts
    const objectionCounts: Record<ObjectionType, number> = {
      diy: objectionConversations.diy.size,
      spouse: objectionConversations.spouse.size,
      price: objectionConversations.price.size,
      competitor: objectionConversations.competitor.size,
      delay: objectionConversations.delay.size,
      not_interested: objectionConversations.not_interested.size,
      no_problem: objectionConversations.no_problem.size,
      no_soliciting: objectionConversations.no_soliciting.size
    }

    // Convert to array format for easier frontend consumption
    const playlists = Object.entries(objectionCounts)
      .filter(([_, count]) => count > 0) // Only include objections that exist
      .map(([objectionType, count]) => ({
        objectionType,
        conversationCount: count
      }))
      .sort((a, b) => b.conversationCount - a.conversationCount) // Sort by count descending

    return NextResponse.json({
      totalConversations: conversations?.length || 0,
      playlists
    })
  } catch (error: any) {
    console.error('Error fetching playlist stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
