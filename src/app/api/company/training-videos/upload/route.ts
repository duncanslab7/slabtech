import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/company/training-videos/upload - Upload video file to storage (company admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is company admin or super admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type (video)
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({
        error: 'Invalid file type. Only video files are allowed.'
      }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const videoId = crypto.randomUUID()
    const fileName = `${videoId}.${fileExt}`
    const filePath = `${profile.company_id}/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('training-videos')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({
        error: `Failed to upload file: ${uploadError.message}`
      }, { status: 500 })
    }

    // Get public URL for the video (signed URL for private bucket)
    const { data: urlData } = supabase.storage
      .from('training-videos')
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      storage_path: filePath,
      video_id: videoId,
      public_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
