import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { createClient } from '@/utils/supabase/server'
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

// POST /api/admin/salespeople/upload-profile-picture - Upload profile picture
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin access
    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const salespersonId = formData.get('salespersonId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!salespersonId) {
      return NextResponse.json({ error: 'Salesperson ID is required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image (JPG, PNG, GIF, or WebP)' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    // Use service role client for storage operations
    const serviceSupabase = createServiceRoleClient()

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const fileName = `${salespersonId}-${Date.now()}.${fileExtension}`
    const filePath = `profile-pictures/${fileName}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await serviceSupabase.storage
      .from('profile-pictures')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: publicUrlData } = serviceSupabase.storage
      .from('profile-pictures')
      .getPublicUrl(filePath)

    if (!publicUrlData?.publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL for uploaded file' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      path: filePath,
      message: 'Profile picture uploaded successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error uploading profile picture:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
