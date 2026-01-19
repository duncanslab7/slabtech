-- ============================================================================
-- Option 2: Preserve Historical Streak Activities
-- ============================================================================
-- Keeps old manual streak_activities records intact
-- Only enforces consistency for NEW data going forward
-- ============================================================================

-- This approach accepts that historical data may not match perfectly
-- The trigger on daily_usage_stats will ensure all FUTURE data is consistent

-- Check current state
SELECT
  'Historical streak records preserved',
  COUNT(*) AS total_orphaned_streaks,
  'These were created manually before unification' AS note
FROM streak_activities sa
LEFT JOIN daily_usage_stats dus ON dus.user_id = sa.user_id AND dus.date = sa.activity_date
WHERE (
  dus.id IS NULL
  OR dus.total_active_minutes < 2
);

-- ============================================================================
-- Modified verification function that only checks RECENT data
-- ============================================================================
-- This version only checks the last 3 days (where new system should be working)

DROP FUNCTION IF EXISTS verify_analytics_consistency_recent(TEXT);

CREATE OR REPLACE FUNCTION verify_analytics_consistency_recent(
  p_user_email TEXT DEFAULT NULL,
  p_days_back INTEGER DEFAULT 3
)
RETURNS TABLE(
  email TEXT,
  usage_days_active INTEGER,
  login_unique_days BIGINT,
  streak_activities BIGINT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH usage_data AS (
    SELECT
      uus.user_id,
      uus.email as user_email,
      (SELECT COUNT(DISTINCT dus.date)
       FROM daily_usage_stats dus
       WHERE dus.user_id = uus.user_id
         AND dus.date >= CURRENT_DATE - (p_days_back || ' days')::INTERVAL
      ) as days_active
    FROM user_usage_summary uus
    WHERE p_user_email IS NULL OR uus.email = p_user_email
  ),
  login_data AS (
    SELECT
      uls.user_id,
      (SELECT COUNT(DISTINCT dus.date)
       FROM daily_usage_stats dus
       WHERE dus.user_id = uls.user_id
         AND dus.date >= CURRENT_DATE - (p_days_back || ' days')::INTERVAL
      ) as unique_days
    FROM user_login_stats uls
    WHERE p_user_email IS NULL OR uls.email = p_user_email
  ),
  streak_data AS (
    SELECT
      sa.user_id,
      COUNT(DISTINCT sa.activity_date) as activities
    FROM streak_activities sa
    WHERE sa.activity_date >= CURRENT_DATE - (p_days_back || ' days')::INTERVAL
    GROUP BY sa.user_id
  )
  SELECT
    ud.user_email::TEXT,
    ud.days_active::INTEGER,
    ld.unique_days::BIGINT,
    COALESCE(sd.activities, 0)::BIGINT,
    CASE
      WHEN ud.days_active = ld.unique_days
        AND ld.unique_days = COALESCE(sd.activities, 0)
      THEN '✓ Consistent'::TEXT
      ELSE '✗ Mismatch'::TEXT
    END as status
  FROM usage_data ud
  LEFT JOIN login_data ld ON ld.user_id = ud.user_id
  LEFT JOIN streak_data sd ON sd.user_id = ud.user_id
  ORDER BY status DESC, ud.user_email;
END;
$$ LANGUAGE plpgsql;

-- Test recent consistency (last 3 days only)
SELECT * FROM verify_analytics_consistency_recent(NULL, 3);

-- ============================================================================
-- Note: With this approach
-- ============================================================================
-- - Historical data (>3 days old) may show mismatches
-- - New data (last 3 days) should be consistent
-- - All FUTURE data will be automatically consistent via triggers
-- - Old manual streak records are preserved for historical accuracy
