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

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// PUT /api/admin/salespeople/[id] - Update a salesperson
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const body = await request.json()
    const { name, display_order } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const updateData: { name: string; display_order?: number } = { name: name.trim() }
    if (display_order !== undefined) {
      updateData.display_order = display_order
    }

    const { data, error } = await supabase
      .from('salespeople')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating salesperson:', error)
      return NextResponse.json(
        { error: 'Failed to update salesperson' },
        { status: 500 }
      )
    }

    return NextResponse.json({ salesperson: data, message: 'Salesperson updated successfully' })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/salespeople/[id] - Delete a salesperson
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Check if this is the "Misc" salesperson (can't delete it)
    const { data: salesperson } = await supabase
      .from('salespeople')
      .select('name')
      .eq('id', id)
      .single()

    if (salesperson?.name === 'Misc') {
      return NextResponse.json(
        { error: 'Cannot delete the Misc category' },
        { status: 400 }
      )
    }

    // Move any transcripts from this salesperson to "Misc"
    const { data: miscSalesperson } = await supabase
      .from('salespeople')
      .select('id')
      .eq('name', 'Misc')
      .single()

    if (miscSalesperson) {
      await supabase
        .from('transcripts')
        .update({ salesperson_id: miscSalesperson.id })
        .eq('salesperson_id', id)
    }

    // Delete the salesperson
    const { error } = await supabase
      .from('salespeople')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting salesperson:', error)
      return NextResponse.json(
        { error: 'Failed to delete salesperson' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Salesperson deleted successfully' })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
