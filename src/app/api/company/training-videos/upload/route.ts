import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/company/training-videos/upload
// Returns a signed upload URL so the client can upload directly to Supabase Storage,
// avoiding Vercel's 4.5 MB serverless request body limit.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { fileName, fileType } = await request.json()

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 })
    }

    if (!fileType.startsWith('video/')) {
      return NextResponse.json({ error: 'Only video files are allowed' }, { status: 400 })
    }

    const fileExt = fileName.split('.').pop()
    const videoId = crypto.randomUUID()
    const storagePath = `${profile.company_id}/${videoId}.${fileExt}`
    const thumbnailPath = `${profile.company_id}/${videoId}.jpg`

    const { data, error } = await supabase.storage
      .from('training-videos')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('Signed URL error:', error)
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
    }

    const { data: thumbData, error: thumbError } = await supabase.storage
      .from('training-thumbnails')
      .createSignedUploadUrl(thumbnailPath)

    if (thumbError) {
      console.warn('Thumbnail signed URL error (continuing without thumbnail):', thumbError)
    }

    const { data: thumbPublic } = supabase.storage
      .from('training-thumbnails')
      .getPublicUrl(thumbnailPath)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
      videoId,
      thumbnailSignedUrl: thumbData?.signedUrl ?? null,
      thumbnailToken: thumbData?.token ?? null,
      thumbnailPath,
      thumbnailPublicUrl: thumbPublic?.publicUrl ?? null,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
