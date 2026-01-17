import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/activity/session
 * Trigger auto-close of inactive sessions and return count
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auto-close inactive sessions (no heartbeat in 5+ minutes)
    const { data: closedCount, error } = await supabase.rpc('auto_close_inactive_sessions');

    if (error) {
      console.error('Error auto-closing sessions:', error);
    }

    return NextResponse.json({ closedSessions: closedCount || 0 });
  } catch (error) {
    console.error('Auto-close sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/activity/session
 * Create a new user session OR end existing session (when called from sendBeacon)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Parse body to check if this is a session end request (from sendBeacon)
    const body = await request.json().catch(() => ({}));

    // If sessionId is provided in POST, this is an end session request from sendBeacon
    if (body.sessionId) {
      console.log('📬 Beacon: Ending session', body.sessionId);

      // End session using database function (don't require auth for beacon calls)
      const { error } = await supabase.rpc('end_user_session', {
        p_session_id: body.sessionId,
      });

      if (error) {
        console.error('Error ending session via beacon:', error);
      }

      return NextResponse.json({ success: true });
    }

    // Otherwise, this is a session creation request
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get IP address and user agent
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                request.headers.get('x-real-ip') ||
                'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create session using database function
    const { data, error } = await supabase.rpc('start_user_session', {
      p_user_id: user.id,
      p_ip_address: ip,
      p_user_agent: userAgent,
    });

    if (error) {
      console.error('Error creating session:', error);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: data });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/activity/session
 * End a user session
 * NOTE: Does NOT require authentication since this is called during logout,
 * but validates session exists before ending it
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Validate session ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      console.warn('Invalid session ID format:', sessionId);
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    console.log('🛑 DELETE: Ending session', sessionId);

    // Verify session exists before trying to end it
    const { data: existingSession, error: checkError } = await supabase
      .from('user_sessions')
      .select('id, user_id, is_active')
      .eq('id', sessionId)
      .single();

    if (checkError || !existingSession) {
      console.warn('Session not found:', sessionId);
      // Return success anyway - session already ended or doesn't exist
      return NextResponse.json({ success: true });
    }

    // Only end if still active
    if (existingSession.is_active) {
      const { error } = await supabase.rpc('end_user_session', {
        p_session_id: sessionId,
      });

      if (error) {
        console.error('Error ending session:', error);
        return NextResponse.json(
          { error: 'Failed to end session' },
          { status: 500 }
        );
      }

      console.log('✅ DELETE: Session ended successfully');
    } else {
      console.log('ℹ️ DELETE: Session already inactive');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session end error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
