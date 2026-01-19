-- ============================================================================
-- Option 1: Remove Orphaned Streak Activities
-- ============================================================================
-- This makes daily_usage_stats the PURE source of truth
-- Deletes streak_activities that don't have corresponding usage data
-- ============================================================================

-- STEP 1: Preview what will be deleted
SELECT
  up.email,
  sa.activity_date,
  sa.activity_type,
  COALESCE(dus.total_active_minutes, 0) AS actual_minutes_that_day,
  'WILL BE DELETED' AS action
FROM streak_activities sa
JOIN user_profiles up ON up.id = sa.user_id
LEFT JOIN daily_usage_stats dus ON dus.user_id = sa.user_id AND dus.date = sa.activity_date
WHERE (
  dus.id IS NULL  -- No daily_usage_stats record
  OR dus.total_active_minutes < 2  -- Didn't meet threshold
)
ORDER BY up.email, sa.activity_date DESC;

-- ============================================================================
-- STEP 2: Uncomment below to actually DELETE orphaned records
-- ============================================================================
-- WARNING: This will permanently delete streak_activities that don't match usage data!
-- Streaks will be recalculated based on remaining activities

/*
DELETE FROM streak_activities sa
USING user_profiles up
LEFT JOIN daily_usage_stats dus ON dus.user_id = sa.user_id AND dus.date = sa.activity_date
WHERE sa.user_id = up.id
  AND (
    dus.id IS NULL
    OR dus.total_active_minutes < 2
  );

-- After deleting, the user_streaks table will auto-update via triggers
-- But let's verify consistency again
SELECT * FROM verify_analytics_consistency();
*/
