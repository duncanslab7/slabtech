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

// DELETE remove subscription
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; salespersonName: string }> }
) {
  try {
    const { id: userId, salespersonName } = await params
    const supabase = await createClient()

    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Use service role client to bypass RLS
    const serviceSupabase = createServiceRoleClient()

    const { error } = await serviceSupabase
      .from('salesperson_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('salesperson_name', salespersonName)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
