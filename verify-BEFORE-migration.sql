-- ============================================================================
-- BEFORE Migration Verification
-- ============================================================================
-- Run this BEFORE the migration to see current inconsistencies
-- ============================================================================

-- Show current state of data across all three systems
SELECT
  up.email,
  up.display_name,

  -- Usage Analytics (from daily_usage_stats)
  COALESCE(
    (SELECT COUNT(DISTINCT dus.date)
     FROM daily_usage_stats dus
     WHERE dus.user_id = up.id
       AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) AS usage_days_active_7d,

  COALESCE(
    (SELECT SUM(dus.total_active_minutes)
     FROM daily_usage_stats dus
     WHERE dus.user_id = up.id
       AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) AS usage_total_minutes_7d,

  -- User Management (from login_logs)
  COALESCE(
    (SELECT COUNT(DISTINCT DATE(ll.logged_in_at))
     FROM login_logs ll
     WHERE ll.user_id = up.id
       AND ll.logged_in_at >= NOW() - INTERVAL '7 days'
    ), 0
  ) AS mgmt_unique_days_7d,

  COALESCE(
    (SELECT COUNT(ll.id)
     FROM login_logs ll
     WHERE ll.user_id = up.id
       AND ll.logged_in_at >= NOW() - INTERVAL '7 days'
    ), 0
  ) AS mgmt_total_logins_7d,

  -- Leaderboard (from streak_activities)
  COALESCE(
    (SELECT COUNT(DISTINCT sa.activity_date)
     FROM streak_activities sa
     WHERE sa.user_id = up.id
       AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) AS streak_activities_7d,

  COALESCE(us.current_streak, 0) AS current_streak,

  -- Status Check
  CASE
    WHEN COALESCE(
      (SELECT COUNT(DISTINCT dus.date)
       FROM daily_usage_stats dus
       WHERE dus.user_id = up.id
         AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
      ), 0
    ) = COALESCE(
      (SELECT COUNT(DISTINCT sa.activity_date)
       FROM streak_activities sa
       WHERE sa.user_id = up.id
         AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
      ), 0
    ) THEN '✓ Match'
    ELSE '✗ MISMATCH'
  END AS consistency_status

FROM user_profiles up
LEFT JOIN user_streaks us ON us.user_id = up.id
WHERE up.is_active = true
ORDER BY consistency_status DESC, up.email;

-- ============================================================================
-- Summary Statistics
-- ============================================================================

SELECT
  COUNT(*) AS total_active_users,
  COUNT(*) FILTER (
    WHERE COALESCE(
      (SELECT COUNT(DISTINCT dus.date)
       FROM daily_usage_stats dus
       WHERE dus.user_id = up.id
         AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
      ), 0
    ) = COALESCE(
      (SELECT COUNT(DISTINCT sa.activity_date)
       FROM streak_activities sa
       WHERE sa.user_id = up.id
         AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
      ), 0
    )
  ) AS consistent_users,
  COUNT(*) FILTER (
    WHERE COALESCE(
      (SELECT COUNT(DISTINCT dus.date)
       FROM daily_usage_stats dus
       WHERE dus.user_id = up.id
         AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
      ), 0
    ) != COALESCE(
      (SELECT COUNT(DISTINCT sa.activity_date)
       FROM streak_activities sa
       WHERE sa.user_id = up.id
         AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
      ), 0
    )
  ) AS mismatched_users
FROM user_profiles up
WHERE up.is_active = true;

-- ============================================================================
-- Show users with activity but missing streaks
-- ============================================================================

SELECT
  up.email,
  up.display_name,
  COALESCE(
    (SELECT COUNT(DISTINCT dus.date)
     FROM daily_usage_stats dus
     WHERE dus.user_id = up.id
       AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) AS days_with_usage_activity,
  COALESCE(
    (SELECT COUNT(DISTINCT sa.activity_date)
     FROM streak_activities sa
     WHERE sa.user_id = up.id
       AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) AS days_with_streak_activity,
  COALESCE(
    (SELECT COUNT(DISTINCT dus.date)
     FROM daily_usage_stats dus
     WHERE dus.user_id = up.id
       AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) - COALESCE(
    (SELECT COUNT(DISTINCT sa.activity_date)
     FROM streak_activities sa
     WHERE sa.user_id = up.id
       AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) AS missing_streak_days,
  'Will be fixed by migration' AS note
FROM user_profiles up
WHERE up.is_active = true
  AND COALESCE(
    (SELECT COUNT(DISTINCT dus.date)
     FROM daily_usage_stats dus
     WHERE dus.user_id = up.id
       AND dus.date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  ) > COALESCE(
    (SELECT COUNT(DISTINCT sa.activity_date)
     FROM streak_activities sa
     WHERE sa.user_id = up.id
       AND sa.activity_date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0
  )
ORDER BY missing_streak_days DESC;
