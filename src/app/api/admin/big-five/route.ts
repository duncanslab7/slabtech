import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextRequest, NextResponse } from 'next/server'

async function verifySuperAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return { error: 'Forbidden', status: 403 }
  return { user }
}

// GET /api/admin/big-five — list all members with their awards and transcript links
export async function GET() {
  try {
    const supabase = await createClient()
    const check = await verifySuperAdmin(supabase)
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

    const serviceSupabase = createServiceRoleClient()

    const { data: members, error } = await serviceSupabase
      .from('big_five_members')
      .select(`
        *,
        big_five_awards ( id, title, year ),
        big_five_transcript_links ( id, salesperson_name )
      `)
      .order('display_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ members: members || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/big-five — create a new member
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const check = await verifySuperAdmin(supabase)
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

    const body = await request.json()
    const { name, bio, instagram_handle, best_day, best_summer, best_week,
            retention_percentage, is_active, display_order } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const serviceSupabase = createServiceRoleClient()
    const { data, error } = await serviceSupabase
      .from('big_five_members')
      .insert({
        name: name.trim(),
        bio: bio || null,
        instagram_handle: instagram_handle || null,
        best_day: best_day || 0,
        best_summer: best_summer || 0,
        best_week: best_week || 0,
        retention_percentage: retention_percentage || 0,
        is_active: is_active !== false,
        display_order: display_order || 0,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ member: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
