import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/salespeople - Public route to get all salespeople for dropdown
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('salespeople')
      .select('id, name, display_order')
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
