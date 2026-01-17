-- ============================================================================
-- FULL DIAGNOSTIC - Find out exactly what's broken
-- ============================================================================
-- Run this entire script and send me the complete output
-- ============================================================================

-- TEST 1: Do tables exist?
DO $$
BEGIN
  RAISE NOTICE '=== TEST 1: Tables ===';
END $$;

SELECT
  table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = tables.table_name
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (
  VALUES
    ('user_sessions'),
    ('activity_heartbeats'),
    ('daily_usage_stats'),
    ('user_activity_events')
) AS tables(table_name);

-- TEST 2: Do functions exist?
DO $$
BEGIN
  RAISE NOTICE '=== TEST 2: Functions ===';
END $$;

SELECT
  routine_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines r
    WHERE r.routine_schema = 'public' AND r.routine_name = functions.routine_name
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (
  VALUES
    ('start_user_session'),
    ('end_user_session'),
    ('record_activity_heartbeat'),
    ('update_daily_usage_stats'),
    ('calculate_active_minutes')
) AS functions(routine_name);

-- TEST 3: Do views exist?
DO $$
BEGIN
  RAISE NOTICE '=== TEST 3: Views ===';
END $$;

SELECT
  table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views v
    WHERE v.table_schema = 'public' AND v.table_name = views.table_name
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (
  VALUES
    ('user_usage_summary'),
    ('company_usage_summary'),
    ('weekly_usage_stats')
) AS views(table_name);

-- TEST 4: Count raw data
DO $$
BEGIN
  RAISE NOTICE '=== TEST 4: Raw Data Counts ===';
END $$;

SELECT
  'user_sessions' as table_name,
  COUNT(*) as row_count
FROM user_sessions

UNION ALL

SELECT
  'activity_heartbeats' as table_name,
  COUNT(*) as row_count
FROM activity_heartbeats

UNION ALL

SELECT
  'daily_usage_stats' as table_name,
  COUNT(*) as row_count
FROM daily_usage_stats

UNION ALL

SELECT
  'user_activity_events' as table_name,
  COUNT(*) as row_count
FROM user_activity_events;

-- TEST 5: Show actual sessions (if any)
DO $$
BEGIN
  RAISE NOTICE '=== TEST 5: Actual Sessions ===';
END $$;

SELECT
  us.id,
  us.user_id,
  up.email,
  us.session_start,
  us.is_active
FROM user_sessions us
LEFT JOIN user_profiles up ON up.id = us.user_id
ORDER BY us.created_at DESC
LIMIT 5;

-- TEST 6: Show actual heartbeats (if any)
DO $$
BEGIN
  RAISE NOTICE '=== TEST 6: Actual Heartbeats ===';
END $$;

SELECT
  ah.user_id,
  up.email,
  ah.page_path,
  ah.activity_type,
  ah.heartbeat_at
FROM activity_heartbeats ah
LEFT JOIN user_profiles up ON up.id = ah.user_id
ORDER BY ah.heartbeat_at DESC
LIMIT 5;

-- TEST 7: Test creating a session manually
DO $$
DECLARE
  v_user_id UUID;
  v_session_id UUID;
BEGIN
  RAISE NOTICE '=== TEST 7: Manual Session Creation ===';

  -- Get first active user
  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ No active users found in user_profiles';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing with user: %', v_user_id;

  -- Try to create session
  BEGIN
    v_session_id := start_user_session(
      v_user_id,
      '127.0.0.1',
      'test-diagnostic'
    );
    RAISE NOTICE '✅ Session created: %', v_session_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Session creation failed: %', SQLERRM;
  END;
END $$;

-- TEST 8: Test recording a heartbeat manually
DO $$
DECLARE
  v_user_id UUID;
  v_session_id UUID;
  v_heartbeat_id UUID;
BEGIN
  RAISE NOTICE '=== TEST 8: Manual Heartbeat Recording ===';

  -- Get most recent session
  SELECT user_id, id INTO v_user_id, v_session_id
  FROM user_sessions
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE NOTICE '❌ No sessions found';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing with session: %', v_session_id;

  -- Try to record heartbeat
  BEGIN
    v_heartbeat_id := record_activity_heartbeat(
      v_session_id,
      '/diagnostic-test',
      'page_active',
      '{}'::jsonb
    );
    RAISE NOTICE '✅ Heartbeat recorded: %', v_heartbeat_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Heartbeat recording failed: %', SQLERRM;
  END;
END $$;

-- TEST 9: Test aggregating stats manually
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  RAISE NOTICE '=== TEST 9: Manual Stats Aggregation ===';

  -- Get user with heartbeats today
  SELECT DISTINCT user_id INTO v_user_id
  FROM activity_heartbeats
  WHERE heartbeat_at >= CURRENT_DATE
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ No heartbeats found for today';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing with user: %', v_user_id;

  -- Try to aggregate
  BEGIN
    PERFORM update_daily_usage_stats(v_user_id, CURRENT_DATE);
    RAISE NOTICE '✅ Stats aggregated successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Stats aggregation failed: %', SQLERRM;
  END;
END $$;

-- TEST 10: Check daily_usage_stats after aggregation
DO $$
BEGIN
  RAISE NOTICE '=== TEST 10: Daily Stats After Aggregation ===';
END $$;

SELECT
  dus.user_id,
  up.email,
  dus.date,
  dus.total_active_minutes,
  dus.session_count
FROM daily_usage_stats dus
LEFT JOIN user_profiles up ON up.id = dus.user_id
ORDER BY dus.date DESC
LIMIT 5;

-- TEST 11: Check the view
DO $$
BEGIN
  RAISE NOTICE '=== TEST 11: User Usage Summary View ===';
END $$;

SELECT
  user_id,
  email,
  company_name,
  lifetime_active_minutes,
  last_7_days_active_minutes,
  total_days_active
FROM user_usage_summary
LIMIT 5;

-- TEST 12: Check RLS policies
DO $$
BEGIN
  RAISE NOTICE '=== TEST 12: RLS Policies ===';
END $$;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_sessions', 'activity_heartbeats', 'daily_usage_stats', 'user_activity_events')
ORDER BY tablename, policyname;

-- TEST 13: Check current user context
DO $$
BEGIN
  RAISE NOTICE '=== TEST 13: Current User Context ===';
END $$;

SELECT
  auth.uid() as current_user_id,
  auth.role() as current_role,
  CASE WHEN auth.uid() IS NULL THEN '❌ Not authenticated in SQL context' ELSE '✅ Authenticated' END as auth_status;

-- FINAL SUMMARY
DO $$
DECLARE
  session_count INTEGER;
  heartbeat_count INTEGER;
  daily_stats_count INTEGER;
  view_count INTEGER;
BEGIN
  RAISE NOTICE '=== FINAL SUMMARY ===';

  SELECT COUNT(*) INTO session_count FROM user_sessions;
  SELECT COUNT(*) INTO heartbeat_count FROM activity_heartbeats;
  SELECT COUNT(*) INTO daily_stats_count FROM daily_usage_stats;
  SELECT COUNT(*) INTO view_count FROM user_usage_summary;

  RAISE NOTICE 'Sessions: %', session_count;
  RAISE NOTICE 'Heartbeats: %', heartbeat_count;
  RAISE NOTICE 'Daily Stats: %', daily_stats_count;
  RAISE NOTICE 'View Rows: %', view_count;

  IF session_count = 0 THEN
    RAISE NOTICE '❌ PROBLEM: No sessions - API not creating sessions or RLS blocking them';
  END IF;

  IF heartbeat_count = 0 THEN
    RAISE NOTICE '❌ PROBLEM: No heartbeats - Frontend not sending heartbeats or RLS blocking them';
  END IF;

  IF heartbeat_count > 0 AND daily_stats_count = 0 THEN
    RAISE NOTICE '❌ PROBLEM: Heartbeats exist but not aggregated - Need to run aggregation';
  END IF;

  IF daily_stats_count > 0 AND view_count = 0 THEN
    RAISE NOTICE '❌ PROBLEM: Daily stats exist but view is empty - View definition issue';
  END IF;

  IF view_count > 0 THEN
    RAISE NOTICE '✅ SUCCESS: Data is in the view - Check frontend dashboard';
  END IF;
END $$;
