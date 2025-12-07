import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE remove transcript assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id: userId, assignmentId } = await params;
    const supabase = await createClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the assignment
    const { error } = await supabase
      .from('transcript_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing assignment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
