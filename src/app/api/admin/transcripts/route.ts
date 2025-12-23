import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextResponse } from 'next/server'

// Helper to verify admin access
async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!['super_admin', 'company_admin'].includes(profile?.role || '')) {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET /api/admin/transcripts - Get all transcripts for admin
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const { profile } = adminCheck

    // Super admins see all transcripts (bypass RLS with service role)
    // Company admins see only their company's transcripts (via RLS)
    let data, error
    if (profile.role === 'super_admin') {
      const serviceSupabase = createServiceRoleClient()
      const result = await serviceSupabase
        .from('transcripts')
        .select('id, created_at, salesperson_name, salesperson_id, original_filename, redaction_config_used, company_id')
        .order('created_at', { ascending: false })
      data = result.data
      error = result.error
    } else {
      // Company admin - RLS will filter to their company
      const result = await supabase
        .from('transcripts')
        .select('id, created_at, salesperson_name, salesperson_id, original_filename, redaction_config_used, company_id')
        .order('created_at', { ascending: false })
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Error fetching transcripts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ transcripts: data })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
