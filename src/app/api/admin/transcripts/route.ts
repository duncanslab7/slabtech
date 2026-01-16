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

// GET /api/admin/transcripts - Get transcripts with pagination
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const { profile } = adminCheck

    // Parse pagination parameters from URL
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Validate pagination parameters
    const validPage = Math.max(1, page)
    const validLimit = Math.min(Math.max(1, limit), 100) // Max 100 per page
    const from = (validPage - 1) * validLimit
    const to = from + validLimit - 1

    // Super admins see all transcripts (bypass RLS with service role)
    // Company admins see only their company's transcripts (via RLS)
    let data, error, count
    if (profile.role === 'super_admin') {
      const serviceSupabase = createServiceRoleClient()

      // Get total count
      const { count: totalCount } = await serviceSupabase
        .from('transcripts')
        .select('*', { count: 'exact', head: true })

      // Get paginated data
      const result = await serviceSupabase
        .from('transcripts')
        .select('id, created_at, salesperson_name, salesperson_id, original_filename, redaction_config_used, company_id')
        .order('created_at', { ascending: false })
        .range(from, to)

      data = result.data
      error = result.error
      count = totalCount
    } else {
      // Company admin - RLS will filter to their company
      // Get total count
      const { count: totalCount } = await supabase
        .from('transcripts')
        .select('*', { count: 'exact', head: true })

      // Get paginated data
      const result = await supabase
        .from('transcripts')
        .select('id, created_at, salesperson_name, salesperson_id, original_filename, redaction_config_used, company_id')
        .order('created_at', { ascending: false })
        .range(from, to)

      data = result.data
      error = result.error
      count = totalCount
    }

    if (error) {
      console.error('Error fetching transcripts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      transcripts: data,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / validLimit) : 0,
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
