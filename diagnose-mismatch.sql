-- ============================================================================
-- Diagnose Mismatch - Find orphaned streak_activities
-- ============================================================================
-- This shows streak_activities that DON'T have corresponding daily_usage_stats
-- ============================================================================

-- Check duncan@gmail.com specifically (3 days usage, 4 days streaks)
SELECT
  'Streak Activities' AS source,
  sa.activity_date,
  sa.activity_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM daily_usage_stats dus
      WHERE dus.user_id = sa.user_id
        AND dus.date = sa.activity_date
        AND dus.total_active_minutes >= 2
    ) THEN '✓ Has matching usage stats'
    ELSE '✗ NO MATCHING USAGE (orphaned)'
  END AS status
FROM streak_activities sa
JOIN user_profiles up ON up.id = sa.user_id
WHERE up.email = 'duncan@gmail.com'
  AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY sa.activity_date DESC;

-- Show daily_usage_stats for comparison
SELECT
  'Daily Usage Stats' AS source,
  dus.date,
  dus.total_active_minutes,
  dus.session_count,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM streak_activities sa
      WHERE sa.user_id = dus.user_id
        AND sa.activity_date = dus.date
    ) THEN '✓ Has streak activity'
    ELSE '✗ Missing streak activity'
  END AS status
FROM daily_usage_stats dus
JOIN user_profiles up ON up.id = dus.user_id
WHERE up.email = 'duncan@gmail.com'
  AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY dus.date DESC;

-- ============================================================================
-- Find ALL orphaned streak_activities across all users
-- ============================================================================

SELECT
  up.email,
  sa.activity_date,
  sa.activity_type,
  COALESCE(dus.total_active_minutes, 0) AS actual_minutes_that_day,
  'Orphaned - no usage data for this date' AS issue
FROM streak_activities sa
JOIN user_profiles up ON up.id = sa.user_id
LEFT JOIN daily_usage_stats dus ON dus.user_id = sa.user_id AND dus.date = sa.activity_date
WHERE sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
  AND (
    dus.id IS NULL  -- No daily_usage_stats record at all
    OR dus.total_active_minutes < 2  -- Or didn't meet the 2-minute threshold
  )
ORDER BY up.email, sa.activity_date DESC;

-- ============================================================================
-- Count orphaned records per user
-- ============================================================================

SELECT
  up.email,
  COUNT(*) AS orphaned_streak_count,
  ARRAY_AGG(sa.activity_date ORDER BY sa.activity_date DESC) AS orphaned_dates
FROM streak_activities sa
JOIN user_profiles up ON up.id = sa.user_id
LEFT JOIN daily_usage_stats dus ON dus.user_id = sa.user_id AND dus.date = sa.activity_date
WHERE sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
  AND (
    dus.id IS NULL
    OR dus.total_active_minutes < 2
  )
GROUP BY up.email
ORDER BY orphaned_streak_count DESC;
