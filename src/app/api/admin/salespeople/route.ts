import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextRequest, NextResponse } from 'next/server'

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

// GET /api/admin/salespeople - Get all salespeople (including Misc) for admin
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const { profile } = adminCheck

    // Super admins see all salespeople (bypass RLS with service role)
    // Company admins see only their company's salespeople (via RLS)
    let data, error
    if (profile.role === 'super_admin') {
      const serviceSupabase = createServiceRoleClient()
      const result = await serviceSupabase
        .from('salespeople')
        .select('id, name, display_order, created_at, company_id')
        .order('display_order', { ascending: true })
      data = result.data
      error = result.error
    } else {
      // Company admin - RLS will filter to their company
      const result = await supabase
        .from('salespeople')
        .select('id, name, display_order, created_at, company_id')
        .order('display_order', { ascending: true })
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Error fetching salespeople:', error)
      return NextResponse.json(
        { error: 'Failed to fetch salespeople' },
        { status: 500 }
      )
    }

    return NextResponse.json({ salespeople: data })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST /api/admin/salespeople - Add a new salesperson
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Get the current max display_order (excluding Misc which is 999)
    const { data: maxOrderData } = await supabase
      .from('salespeople')
      .select('display_order')
      .lt('display_order', 999)
      .order('display_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (maxOrderData?.display_order || 0) + 1

    const { data, error } = await supabase
      .from('salespeople')
      .insert({ name: name.trim(), display_order: nextOrder })
      .select()
      .single()

    if (error) {
      console.error('Error adding salesperson:', error)
      return NextResponse.json(
        { error: 'Failed to add salesperson' },
        { status: 500 }
      )
    }

    return NextResponse.json({ salesperson: data, message: 'Salesperson added successfully' })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
