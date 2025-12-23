import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/streak
 * Fetches the current user's streak data
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's streak data
    const { data: streakData, error: streakError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (streakError && streakError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching streak:', streakError);
      return NextResponse.json({ error: 'Failed to fetch streak' }, { status: 500 });
    }

    // Get this week's activity days (Sunday = 0, Saturday = 6)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Go to Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const { data: weekActivities } = await supabase
      .from('streak_activities')
      .select('activity_date')
      .eq('user_id', user.id)
      .gte('activity_date', startOfWeek.toISOString().split('T')[0]);

    // Convert activity dates to day-of-week numbers (0-6)
    const activity_days = weekActivities
      ? weekActivities.map((activity) => new Date(activity.activity_date).getDay())
      : [];

    // If no streak data exists, return default values
    if (!streakData) {
      return NextResponse.json({
        current_streak: 0,
        longest_streak: 0,
        total_activities: 0,
        last_activity_date: null,
        activity_days,
      });
    }

    return NextResponse.json({
      ...streakData,
      activity_days,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/streak:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/streak
 * Logs a new activity (e.g., listening to audio) and updates streak
 * Body: { transcript_id?: string, activity_type?: 'audio_listen' }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { transcript_id, activity_type = 'audio_listen' } = body;

    // Get user's company_id for multi-tenancy
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    // Insert activity (will trigger the update_user_streak function automatically)
    const { data: activityData, error: activityError } = await supabase
      .from('streak_activities')
      .insert({
        user_id: user.id,
        company_id: userProfile?.company_id,
        activity_type,
        transcript_id: transcript_id || null,
        activity_date: new Date().toISOString().split('T')[0], // Today's date
      })
      .select()
      .single();

    if (activityError) {
      // If it's a duplicate (already logged today), that's okay
      if (activityError.code === '23505') {
        // Postgres unique violation
        return NextResponse.json(
          { message: 'Activity already logged today', alreadyLogged: true },
          { status: 200 }
        );
      }

      console.error('Error logging activity:', activityError);
      return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
    }

    // Fetch updated streak data
    const { data: updatedStreak, error: streakError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (streakError) {
      console.error('Error fetching updated streak:', streakError);
      return NextResponse.json({ error: 'Failed to fetch updated streak' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      streak: updatedStreak,
      activity: activityData,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/streak:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
