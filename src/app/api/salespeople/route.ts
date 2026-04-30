import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextResponse } from 'next/server'

// GET /api/salespeople - Public route to get all salespeople for dropdown
// Uses service role to bypass RLS so cross-company salespeople (e.g. global Big 5 reps) always appear.
export async function GET() {
  try {
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from('salespeople')
      .select('id, name, display_order, profile_picture_url, about')
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching salespeople:', error)
      return NextResponse.json(
        { error: 'Failed to fetch salespeople' },
        { status: 500 }
      )
    }

    // Filter out "Misc" from the public dropdown
    const filteredData = data?.filter(sp => sp.name !== 'Misc') || []

    return NextResponse.json({ salespeople: filteredData })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
