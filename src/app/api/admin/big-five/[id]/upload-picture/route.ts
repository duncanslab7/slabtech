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

// POST /api/admin/big-five/[id]/upload-picture
// FormData: file (image), type ('profile' | 'background')
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const check = await verifySuperAdmin(supabase)
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = (formData.get('type') as string) || 'profile'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type))
      return NextResponse.json({ error: 'Invalid file type (JPG, PNG, WebP only)' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

    const serviceSupabase = createServiceRoleClient()
    const ext = file.name.split('.').pop()
    const fileName = `big-five/${id}-${type}-${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await serviceSupabase.storage
      .from('profile-pictures')
      .upload(fileName, Buffer.from(arrayBuffer), { contentType: file.type, upsert: true })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = serviceSupabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName)

    // Update the appropriate column
    const column = type === 'background' ? 'background_picture_url' : 'profile_picture_url'
    const { error: updateError } = await serviceSupabase
      .from('big_five_members')
      .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({ url: publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
