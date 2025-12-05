import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/admin/transcripts - Get all transcripts for admin
export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('transcripts')
      .select('id, created_at, salesperson_name, salesperson_id, original_filename, redaction_config_used')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching transcripts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ transcripts: data })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
