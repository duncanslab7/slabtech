import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { NextRequest, NextResponse } from 'next/server';

// Helper to verify admin access
async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }

  return { user, profile };
}

// POST assign transcripts to user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();

    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const body = await request.json();
    const { transcriptIds } = body;

    if (!transcriptIds || !Array.isArray(transcriptIds) || transcriptIds.length === 0) {
      return NextResponse.json({ error: 'No transcripts specified' }, { status: 400 });
    }

    // Use service role client to bypass RLS
    const serviceSupabase = createServiceRoleClient();

    // Verify user exists
    const { data: targetUser } = await serviceSupabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create assignments
    const assignments = transcriptIds.map((transcriptId: string) => ({
      user_id: userId,
      transcript_id: transcriptId,
      assigned_by: adminCheck.user.id,
    }));

    const { error: assignError } = await serviceSupabase
      .from('transcript_assignments')
      .upsert(assignments, {
        onConflict: 'transcript_id,user_id',
        ignoreDuplicates: true,
      });

    if (assignError) {
      throw assignError;
    }

    return NextResponse.json({ success: true, count: transcriptIds.length });
  } catch (error: any) {
    console.error('Error assigning transcripts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET user's transcript assignments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();

    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // Use service role client to bypass RLS
    const serviceSupabase = createServiceRoleClient();

    const { data: assignments, error } = await serviceSupabase
      .from('transcript_assignments')
      .select(`
        id,
        assigned_at,
        transcripts (
          id,
          original_filename,
          salesperson_name,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ assignments: assignments || [] });
  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
