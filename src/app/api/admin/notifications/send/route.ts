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

// POST /api/admin/notifications/send
// Body: {
//   title, body,
//   category,
//   target_type ('all'|'company'|'user'),
//   target_id?,
//   media_url?,
//   media_type? ('image'|'video'|'audio'|'gif'),
//   thumbnail_url?
// }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const check = await verifySuperAdmin(supabase)
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

    const reqBody = await request.json()
    const {
      title,
      body: msgBody,
      category = 'updates',
      target_type = 'all',
      target_id,
      media_url = null,
      media_type = null,
      thumbnail_url = null,
    } = reqBody

    if (!title?.trim() || !msgBody?.trim()) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    const serviceSupabase = createServiceRoleClient()

    // Always create a broadcast record so the mobile app can deep-link to it
    // (even text-only broadcasts get a row, in case we want to display them
    // in a "broadcast history" view later).
    const { data: broadcastRow, error: broadcastErr } = await serviceSupabase
      .from('broadcasts')
      .insert({
        sent_by: check.user.id,
        title: title.trim(),
        body: msgBody.trim(),
        category,
        media_url,
        media_type,
        thumbnail_url,
        target_type,
        target_id: target_id || null,
      })
      .select('id')
      .single()
    if (broadcastErr) throw broadcastErr
    const broadcastId = broadcastRow.id

    // Fetch target push tokens based on scope
    let tokensQuery = serviceSupabase
      .from('user_push_tokens')
      .select('token, user_id')
      .eq('is_active', true)

    if (target_type === 'company' && target_id) {
      const { data: companyUsers } = await serviceSupabase
        .from('user_profiles')
        .select('id')
        .eq('company_id', target_id)
        .eq('is_active', true)

      const userIds = companyUsers?.map((u) => u.id) ?? []
      if (userIds.length === 0) {
        return NextResponse.json({ sent: 0, message: 'No users found for this company' })
      }
      tokensQuery = tokensQuery.in('user_id', userIds)
    } else if (target_type === 'user' && target_id) {
      tokensQuery = tokensQuery.eq('user_id', target_id)
    }

    const { data: tokenRows, error: tokenErr } = await tokensQuery
    if (tokenErr) throw tokenErr

    if (!tokenRows?.length) {
      return NextResponse.json({ sent: 0, message: 'No active push tokens found' })
    }

    // Filter by notification preference for the category
    const prefKey = category === 'company_alerts' ? 'company_alerts'
      : category === 'big_days' ? 'big_days'
      : category === 'updates' ? 'updates'
      : null

    let eligibleUserIds = tokenRows.map((t) => t.user_id)

    if (prefKey) {
      const { data: prefs } = await serviceSupabase
        .from('notification_preferences')
        .select(`user_id, ${prefKey}`)
        .in('user_id', eligibleUserIds)

      const prefMap = new Map<string, boolean>()
      prefs?.forEach((p: any) => prefMap.set(p.user_id, p[prefKey]))

      eligibleUserIds = eligibleUserIds.filter((id) => prefMap.get(id) !== false)
    }

    const tokens = tokenRows
      .filter((t) => eligibleUserIds.includes(t.user_id))
      .map((t) => t.token)
      .filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))

    if (tokens.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No eligible recipients (all opted out)' })
    }

    // Send via Expo Push API in batches of 100
    let sent = 0
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100)
      const messages = batch.map((to) => ({
        to,
        sound: 'default',
        title: title.trim(),
        body: msgBody.trim(),
        // The mobile app reads `broadcast_id` to deep-link to BroadcastDetail
        data: {
          type: category,
          broadcast_id: broadcastId,
          ...(media_url ? { has_media: true } : {}),
        },
      }))

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })

      if (res.ok) sent += batch.length
    }

    // Log the broadcast (links back to the broadcast row)
    await serviceSupabase.from('notification_log').insert({
      sent_by: check.user.id,
      title: title.trim(),
      body: msgBody.trim(),
      category,
      target_type,
      target_id: target_id || null,
      recipient_count: sent,
      broadcast_id: broadcastId,
    })

    return NextResponse.json({ sent, total_tokens: tokens.length, broadcast_id: broadcastId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
