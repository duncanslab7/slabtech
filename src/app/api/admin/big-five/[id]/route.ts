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

// PUT /api/admin/big-five/[id] — update member + sync awards + transcript links
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const check = await verifySuperAdmin(supabase)
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

    const body = await request.json()
    const { awards, transcript_links, ...fields } = body

    const serviceSupabase = createServiceRoleClient()

    // Update member fields
    const { data: member, error: updateError } = await serviceSupabase
      .from('big_five_members')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) throw updateError

    // Sync awards if provided
    if (Array.isArray(awards)) {
      await serviceSupabase.from('big_five_awards').delete().eq('member_id', params.id)
      if (awards.length > 0) {
        await serviceSupabase.from('big_five_awards').insert(
          awards.map((a: { title: string; year: number }) => ({
            member_id: params.id,
            title: a.title,
            year: a.year,
          }))
        )
      }
    }

    // Sync transcript links if provided
    if (Array.isArray(transcript_links)) {
      await serviceSupabase.from('big_five_transcript_links').delete().eq('member_id', params.id)
      if (transcript_links.length > 0) {
        await serviceSupabase.from('big_five_transcript_links').insert(
          transcript_links.map((name: string) => ({
            member_id: params.id,
            salesperson_name: name,
          }))
        )
      }
    }

    return NextResponse.json({ member })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin/big-five/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const check = await verifySuperAdmin(supabase)
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

    const serviceSupabase = createServiceRoleClient()
    const { error } = await serviceSupabase.from('big_five_members').delete().eq('id', params.id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
