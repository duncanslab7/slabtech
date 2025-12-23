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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET list of all unique salesperson names
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Use service role client to bypass RLS
    const serviceSupabase = createServiceRoleClient()

    // Get all salespeople from the salespeople table
    const { data: salespeople, error } = await serviceSupabase
      .from('salespeople')
      .select('name')
      .order('name')

    if (error) {
      throw error
    }

    // Extract just the names
    const salespersonNames = salespeople?.map(s => s.name) || []

    return NextResponse.json({ salespeople: salespersonNames })
  } catch (error: any) {
    console.error('Error fetching salespeople:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
