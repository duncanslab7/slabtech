-- ============================================================================
-- Fix Broken Streaks - Reset current_streak to 0 for inactive users
-- ============================================================================
-- A streak is broken if last_activity_date is NOT yesterday or today
-- ============================================================================

-- STEP 1: Preview which streaks will be reset
SELECT
  up.email,
  us.last_activity_date,
  us.current_streak AS old_streak,
  0 AS new_streak,
  CURRENT_DATE - us.last_activity_date AS days_since_last_activity,
  'Streak broken - will be reset to 0' AS action
FROM user_streaks us
JOIN user_profiles up ON up.id = us.user_id
WHERE us.current_streak > 0
  AND us.last_activity_date IS NOT NULL
  AND us.last_activity_date < CURRENT_DATE - INTERVAL '1 day'
ORDER BY us.last_activity_date DESC;

-- ============================================================================
-- STEP 2: Reset broken streaks
-- ============================================================================
-- Sets current_streak to 0 for users whose last activity was before yesterday

UPDATE user_streaks
SET
  current_streak = 0,
  updated_at = NOW()
WHERE current_streak > 0
  AND last_activity_date IS NOT NULL
  AND last_activity_date < CURRENT_DATE - INTERVAL '1 day';

-- ============================================================================
-- STEP 3: Create a function to maintain streaks daily
-- ============================================================================
-- This should be run daily via cron to keep streaks accurate

CREATE OR REPLACE FUNCTION reset_broken_streaks()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Reset streaks for users who haven't had activity yesterday or today
  UPDATE user_streaks
  SET
    current_streak = 0,
    updated_at = NOW()
  WHERE current_streak > 0
    AND last_activity_date IS NOT NULL
    AND last_activity_date < CURRENT_DATE - INTERVAL '1 day';

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  RAISE NOTICE 'Reset % broken streaks', v_reset_count;

  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_broken_streaks() IS
'Resets current_streak to 0 for users whose last_activity_date is before yesterday. Run daily via cron.';

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================

-- Check that no one has a current streak with old last_activity_date
SELECT
  up.email,
  us.current_streak,
  us.last_activity_date,
  CURRENT_DATE - us.last_activity_date AS days_since_activity,
  CASE
    WHEN us.current_streak = 0 THEN '✓ Correct (broken streak reset)'
    WHEN us.last_activity_date >= CURRENT_DATE - INTERVAL '1 day' THEN '✓ Correct (active streak)'
    ELSE '✗ ERROR - should be 0!'
  END AS status
FROM user_streaks us
JOIN user_profiles up ON up.id = us.user_id
WHERE up.is_active = true
ORDER BY status DESC, us.last_activity_date DESC;

-- ============================================================================
-- Summary
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Broken Streaks Fixed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Users with old activity dates now show current_streak = 0';
  RAISE NOTICE 'Only users active today or yesterday have current_streak > 0';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Set up daily cron: SELECT reset_broken_streaks();';
  RAISE NOTICE '2. Set up daily cron: SELECT sync_daily_stats_to_streaks();';
  RAISE NOTICE '========================================';
END $$;
