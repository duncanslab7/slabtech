-- ============================================================================
-- Investigate Why daily_usage_stats is Missing Data
-- ============================================================================
-- Check if the problem is with heartbeats or with the aggregation function
-- ============================================================================

-- STEP 1: Check if activity_heartbeats exist for these dates
SELECT
  'Activity Heartbeats' AS check_type,
  DATE(ah.heartbeat_at) AS date,
  up.email,
  COUNT(*) AS heartbeat_count,
  MIN(ah.heartbeat_at) AS first_heartbeat,
  MAX(ah.heartbeat_at) AS last_heartbeat,
  ah.activity_type,
  'Heartbeats exist but not aggregated!' AS issue
FROM activity_heartbeats ah
JOIN user_profiles up ON up.id = ah.user_id
WHERE up.email IN ('duncan@gmail.com', 'alstoniallen@icloud.com', 'cadenbradshaw8@gmail.com')
  AND DATE(ah.heartbeat_at) IN ('2026-01-16', '2026-01-15', '2026-01-09', '2025-12-30', '2025-12-29', '2025-12-28')
GROUP BY DATE(ah.heartbeat_at), up.email, ah.activity_type
ORDER BY up.email, date DESC;

-- STEP 2: Check if user_sessions exist for these dates
SELECT
  'User Sessions' AS check_type,
  DATE(us.session_start) AS date,
  up.email,
  COUNT(*) AS session_count,
  MIN(us.session_start) AS first_session,
  MAX(us.last_activity) AS last_activity,
  SUM(CASE WHEN us.is_active = true THEN 1 ELSE 0 END) AS still_active_sessions,
  'Sessions exist but daily_usage_stats not created!' AS issue
FROM user_sessions us
JOIN user_profiles up ON up.id = us.user_id
WHERE up.email IN ('duncan@gmail.com', 'alstoniallen@icloud.com', 'cadenbradshaw8@gmail.com')
  AND DATE(us.session_start) IN ('2026-01-16', '2026-01-15', '2026-01-09', '2025-12-30', '2025-12-29', '2025-12-28')
GROUP BY DATE(us.session_start), up.email
ORDER BY up.email, date DESC;

-- STEP 3: Check if daily_usage_stats exist but with 0 minutes
SELECT
  'Daily Usage Stats' AS check_type,
  dus.date,
  up.email,
  dus.total_active_minutes,
  dus.session_count,
  dus.first_activity,
  dus.last_activity,
  CASE
    WHEN dus.total_active_minutes = 0 THEN 'Record exists but 0 minutes - aggregation failed!'
    ELSE 'Has data'
  END AS status
FROM daily_usage_stats dus
JOIN user_profiles up ON up.id = dus.user_id
WHERE up.email IN ('duncan@gmail.com', 'alstoniallen@icloud.com', 'cadenbradshaw8@gmail.com')
  AND dus.date IN ('2026-01-16', '2026-01-15', '2026-01-09', '2025-12-30', '2025-12-29', '2025-12-28')
ORDER BY up.email, dus.date DESC;

-- STEP 4: Check for dates with streak_activities but NO daily_usage_stats at all
SELECT
  'Missing daily_usage_stats' AS check_type,
  sa.activity_date,
  up.email,
  sa.activity_type,
  'No daily_usage_stats record created!' AS issue
FROM streak_activities sa
JOIN user_profiles up ON up.id = sa.user_id
LEFT JOIN daily_usage_stats dus ON dus.user_id = sa.user_id AND dus.date = sa.activity_date
WHERE up.email IN ('duncan@gmail.com', 'alstoniallen@icloud.com', 'cadenbradshaw8@gmail.com')
  AND sa.activity_date IN ('2026-01-16', '2026-01-15', '2026-01-09', '2025-12-30', '2025-12-29', '2025-12-28')
  AND dus.id IS NULL
ORDER BY up.email, sa.activity_date DESC;

-- STEP 5: Summary - what's the root cause?
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM activity_heartbeats ah
      WHERE DATE(ah.heartbeat_at) IN ('2026-01-16', '2026-01-15')
    ) THEN 'Heartbeats exist'
    ELSE 'NO HEARTBEATS - frontend not sending them!'
  END AS heartbeat_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_sessions us
      WHERE DATE(us.session_start) IN ('2026-01-16', '2026-01-15')
    ) THEN 'Sessions exist'
    ELSE 'NO SESSIONS - session tracking not working!'
  END AS session_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM daily_usage_stats dus
      WHERE dus.date IN ('2026-01-16', '2026-01-15')
        AND dus.total_active_minutes = 0
    ) THEN 'daily_usage_stats exists with 0 minutes - calculate_active_minutes() failed!'
    WHEN EXISTS (
      SELECT 1 FROM daily_usage_stats dus
      WHERE dus.date IN ('2026-01-16', '2026-01-15')
    ) THEN 'daily_usage_stats exists with data'
    ELSE 'NO daily_usage_stats - update_daily_usage_stats() not called!'
  END AS daily_stats_status;
