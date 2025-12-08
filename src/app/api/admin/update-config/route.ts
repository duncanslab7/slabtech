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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Parse request body
    const body = await request.json()
    const { pii_fields } = body

    if (!pii_fields || typeof pii_fields !== 'string') {
      return NextResponse.json(
        { error: 'Invalid pii_fields value' },
        { status: 400 }
      )
    }

    // Validate that pii_fields is not empty
    const trimmedFields = pii_fields.trim()
    if (!trimmedFields) {
      return NextResponse.json(
        { error: 'PII fields cannot be empty' },
        { status: 400 }
      )
    }

    // Update the redaction config (single row with id=1)
    const { data, error } = await supabase
      .from('redaction_config')
      .update({ pii_fields: trimmedFields })
      .eq('id', 1)
      .select()
      .single()

    if (error) {
      console.error('Error updating config:', error)
      return NextResponse.json(
        { error: 'Failed to update configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      pii_fields: data.pii_fields,
      message: 'Configuration updated successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
