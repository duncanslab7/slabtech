-- ============================================================================
-- Analytics Consistency Verification Script
-- ============================================================================
-- Run this BEFORE and AFTER the migration to see the difference
-- ============================================================================

-- ============================================================================
-- TEST 1: Check all users for consistency
-- ============================================================================
SELECT * FROM verify_analytics_consistency();

-- Expected BEFORE migration: Many rows will show "✗ Mismatch"
-- Expected AFTER migration: All rows should show "✓ Consistent"

-- ============================================================================
-- TEST 2: Check specific user (replace with actual email)
-- ============================================================================
-- SELECT * FROM verify_analytics_consistency('duncan@slabtraining.com');

-- ============================================================================
-- TEST 3: Compare raw data side-by-side for debugging
-- ============================================================================
SELECT
  up.email,
  up.display_name,

  -- Usage Analytics (from daily_usage_stats)
  COALESCE(uus.days_active_last_7, 0) AS usage_days_7d,
  COALESCE(uus.last_7_days_active_minutes, 0) AS usage_minutes_7d,
  COALESCE(uus.last_7_days_sessions, 0) AS usage_sessions_7d,

  -- User Management (from login_logs / daily_usage_stats after migration)
  COALESCE(uls.unique_days_logged_in, 0) AS mgmt_unique_days_7d,
  COALESCE(uls.logins_last_7_days, 0) AS mgmt_logins_7d,

  -- Leaderboard (from user_streaks)
  COALESCE(us.current_streak, 0) AS leaderboard_current_streak,
  COALESCE(us.longest_streak, 0) AS leaderboard_longest_streak,

  -- Streak Activities Count (manual check)
  COALESCE(
    (SELECT COUNT(*)
     FROM streak_activities sa
     WHERE sa.user_id = up.id
       AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) AS streak_activities_7d,

  -- Status
  CASE
    WHEN COALESCE(uus.days_active_last_7, 0) = COALESCE(uls.unique_days_logged_in, 0)
      AND COALESCE(uls.unique_days_logged_in, 0) = COALESCE(
        (SELECT COUNT(*)
         FROM streak_activities sa
         WHERE sa.user_id = up.id
           AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
        ), 0
      )
    THEN '✓ ALL MATCH'
    ELSE '✗ MISMATCH'
  END AS consistency_status

FROM user_profiles up
LEFT JOIN user_usage_summary uus ON uus.user_id = up.id
LEFT JOIN user_login_stats uls ON uls.user_id = up.id
LEFT JOIN user_streaks us ON us.user_id = up.id
WHERE up.is_active = true
ORDER BY consistency_status DESC, up.email;

-- ============================================================================
-- TEST 4: Count mismatches
-- ============================================================================
WITH consistency_check AS (
  SELECT * FROM verify_analytics_consistency()
)
SELECT
  COUNT(*) FILTER (WHERE status = '✓ Consistent') AS consistent_users,
  COUNT(*) FILTER (WHERE status = '✗ Mismatch') AS mismatched_users,
  COUNT(*) AS total_users,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = '✓ Consistent') / NULLIF(COUNT(*), 0),
    2
  ) AS consistency_percentage
FROM consistency_check;

-- ============================================================================
-- TEST 5: Show users with active time but no streaks (will be fixed by migration)
-- ============================================================================
SELECT
  up.email,
  up.display_name,
  uus.days_active_last_7 AS days_with_activity,
  COALESCE(
    (SELECT COUNT(*)
     FROM streak_activities sa
     WHERE sa.user_id = up.id
       AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) AS streak_activities_count,
  'Missing ' || (
    uus.days_active_last_7 - COALESCE(
      (SELECT COUNT(*)
       FROM streak_activities sa
       WHERE sa.user_id = up.id
         AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
      ), 0
    )
  ) || ' streak records' AS issue
FROM user_profiles up
JOIN user_usage_summary uus ON uus.user_id = up.id
WHERE uus.days_active_last_7 > 0
  AND uus.days_active_last_7 != COALESCE(
    (SELECT COUNT(*)
     FROM streak_activities sa
     WHERE sa.user_id = up.id
       AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  )
ORDER BY uus.days_active_last_7 DESC;

-- Expected BEFORE migration: Shows users who have activity but no streak records
-- Expected AFTER migration: Empty result (all users with activity have streaks)

-- ============================================================================
-- TEST 6: Check the 2-minute threshold is working
-- ============================================================================
SELECT
  dus.user_id,
  up.email,
  dus.date,
  dus.total_active_minutes,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM streak_activities sa
      WHERE sa.user_id = dus.user_id
        AND sa.activity_date = dus.date
    ) THEN '✓ Has Streak'
    ELSE '✗ Missing Streak'
  END AS streak_status,
  CASE
    WHEN dus.total_active_minutes >= 2 THEN 'Should have streak'
    ELSE 'Below threshold'
  END AS expected_status
FROM daily_usage_stats dus
JOIN user_profiles up ON up.id = dus.user_id
WHERE dus.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY dus.date DESC, dus.user_id;

-- Expected AFTER migration:
-- - All rows with total_active_minutes >= 2 should show "✓ Has Streak"
-- - All rows with total_active_minutes < 2 should show "✗ Missing Streak"

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
DO $$
DECLARE
  v_total_users INTEGER;
  v_consistent_users INTEGER;
  v_mismatch_users INTEGER;
  v_percentage NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = '✓ Consistent'),
    COUNT(*) FILTER (WHERE status = '✗ Mismatch')
  INTO v_total_users, v_consistent_users, v_mismatch_users
  FROM verify_analytics_consistency();

  v_percentage := ROUND(100.0 * v_consistent_users / NULLIF(v_total_users, 0), 2);

  RAISE NOTICE '========================================';
  RAISE NOTICE 'ANALYTICS CONSISTENCY REPORT';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Users: %', v_total_users;
  RAISE NOTICE 'Consistent: % (%.2f%%)', v_consistent_users, v_percentage;
  RAISE NOTICE 'Mismatched: %', v_mismatch_users;
  RAISE NOTICE '========================================';

  IF v_mismatch_users = 0 THEN
    RAISE NOTICE '✓ ALL SYSTEMS IN SYNC!';
    RAISE NOTICE 'Usage Analytics, User Management, and';
    RAISE NOTICE 'Leaderboard are showing consistent data.';
  ELSE
    RAISE NOTICE '✗ INCONSISTENCIES DETECTED';
    RAISE NOTICE 'Run the analytics-unification-migration.sql';
    RAISE NOTICE 'to fix data consistency issues.';
  END IF;

  RAISE NOTICE '========================================';
END $$;
