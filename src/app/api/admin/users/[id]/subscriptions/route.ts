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

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET user's subscriptions
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

    const { data: subscriptions, error } = await serviceSupabase
      .from('salesperson_subscriptions')
      .select('id, salesperson_name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ subscriptions: subscriptions || [] })
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST add subscription
export async function POST(
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

    const body = await request.json()
    const { salespersonName } = body

    if (!salespersonName || typeof salespersonName !== 'string') {
      return NextResponse.json({ error: 'Salesperson name is required' }, { status: 400 })
    }

    // Use service role client to bypass RLS
    const serviceSupabase = createServiceRoleClient()

    // Verify user exists
    const { data: targetUser } = await serviceSupabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create subscription (upsert to handle duplicates gracefully)
    const { data, error } = await serviceSupabase
      .from('salesperson_subscriptions')
      .upsert({
        user_id: userId,
        salesperson_name: salespersonName
      }, {
        onConflict: 'user_id,salesperson_name',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, subscription: data })
  } catch (error: any) {
    console.error('Error creating subscription:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
