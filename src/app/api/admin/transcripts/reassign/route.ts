import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

// PATCH /api/admin/transcripts/reassign - Reassign transcripts to a different salesperson
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const body = await request.json()
    const { transcriptIds, salespersonId, salespersonName } = body

    // Validate request body
    if (!transcriptIds || !Array.isArray(transcriptIds) || transcriptIds.length === 0) {
      return NextResponse.json(
        { error: 'transcriptIds must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!salespersonId || typeof salespersonId !== 'string') {
      return NextResponse.json(
        { error: 'salespersonId is required and must be a string' },
        { status: 400 }
      )
    }

    if (!salespersonName || typeof salespersonName !== 'string') {
      return NextResponse.json(
        { error: 'salespersonName is required and must be a string' },
        { status: 400 }
      )
    }

    // Verify the salesperson exists
    const { data: salesperson, error: spError } = await supabase
      .from('salespeople')
      .select('id, name')
      .eq('id', salespersonId)
      .single()

    if (spError || !salesperson) {
      return NextResponse.json(
        { error: 'Salesperson not found' },
        { status: 404 }
      )
    }

    // Update transcripts - update BOTH salesperson_id and salesperson_name
    const { data, error } = await supabase
      .from('transcripts')
      .update({
        salesperson_id: salespersonId,
        salesperson_name: salespersonName
      })
      .in('id', transcriptIds)
      .select()

    if (error) {
      console.error('Error updating transcripts:', error)
      return NextResponse.json(
        { error: 'Failed to update transcripts' },
        { status: 500 }
      )
    }

    const count = data?.length || 0

    return NextResponse.json({
      message: `Successfully moved ${count} transcript${count !== 1 ? 's' : ''} to ${salespersonName}`,
      count,
      data
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
