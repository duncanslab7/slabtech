import { createClient } from '@/utils/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

// Helper to verify user authentication
async function verifyAuth(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { error: 'Profile not found', status: 404 }
  }

  return { user, profile }
}

// DELETE /api/chat/messages/[id]/reactions/[emoji] - Remove reaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emoji: string }> }
) {
  try {
    const supabase = await createClient()
    const { id, emoji } = await params

    // Verify authentication
    const authCheck = await verifyAuth(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { user } = authCheck

    // URL decode the emoji
    const decodedEmoji = decodeURIComponent(emoji)

    // Delete reaction (RLS ensures user can only delete their own)
    const { error: deleteError } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', id)
      .eq('user_id', user.id)
      .eq('emoji', decodedEmoji)

    if (deleteError) {
      console.error('Error deleting reaction:', deleteError)
      return NextResponse.json({ error: 'Failed to delete reaction' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
