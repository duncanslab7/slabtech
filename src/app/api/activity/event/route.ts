import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/activity/event
 * Track a specific user activity event
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionId, eventType, eventData = {} } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: 'Event type required' },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes = [
      'login',
      'logout',
      'transcript_upload',
      'transcript_view',
      'audio_play',
      'audio_pause',
      'audio_complete',
      'page_view',
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Get user's company
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    // Insert activity event
    const { data, error } = await supabase
      .from('user_activity_events')
      .insert({
        user_id: user.id,
        company_id: profile?.company_id || null,
        session_id: sessionId || null,
        event_type: eventType,
        event_data: eventData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording event:', {
        error,
        details: error.message,
        hint: error.hint,
        code: error.code,
        userId: user.id,
        eventType,
        sessionId,
      });
      return NextResponse.json(
        { error: 'Failed to record event', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ eventId: data.id, success: true });
  } catch (error) {
    console.error('Event recording error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
