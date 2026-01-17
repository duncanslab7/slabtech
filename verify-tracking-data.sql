-- ============================================================================
-- Verify Tracking Data - Run this to see what data actually exists
-- ============================================================================

-- 1. Check if ANY sessions exist
SELECT
  COUNT(*) as total_sessions,
  COUNT(DISTINCT user_id) as unique_users
FROM user_sessions;

-- 2. See the actual sessions
SELECT
  id,
  user_id,
  session_start,
  session_end,
  is_active,
  created_at
FROM user_sessions
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if ANY heartbeats exist
SELECT
  COUNT(*) as total_heartbeats,
  COUNT(DISTINCT user_id) as unique_users
FROM activity_heartbeats;

-- 4. See actual heartbeats
SELECT
  user_id,
  page_path,
  activity_type,
  heartbeat_at
FROM activity_heartbeats
ORDER BY heartbeat_at DESC
LIMIT 10;

-- 5. Check user_profiles - do users have company_id?
SELECT
  id,
  email,
  company_id,
  role,
  is_active
FROM user_profiles
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check if daily_usage_stats has any data
SELECT
  COUNT(*) as total_days,
  COUNT(DISTINCT user_id) as unique_users
FROM daily_usage_stats;

-- 7. See actual daily stats
SELECT
  user_id,
  date,
  total_active_minutes,
  session_count
FROM daily_usage_stats
ORDER BY date DESC
LIMIT 10;

-- 8. Test the user_usage_summary view
SELECT COUNT(*) as rows_in_view
FROM user_usage_summary;

-- 9. See what's actually in the view
SELECT
  user_id,
  email,
  company_id,
  company_name,
  lifetime_active_minutes,
  last_7_days_active_minutes,
  total_days_active
FROM user_usage_summary
LIMIT 10;

-- 10. Check if you specifically are in the data (replace with your email)
SELECT
  'Sessions' as type,
  COUNT(*) as count
FROM user_sessions us
JOIN user_profiles up ON up.id = us.user_id
WHERE up.email = 'YOUR_EMAIL_HERE'

UNION ALL

SELECT
  'Heartbeats' as type,
  COUNT(*) as count
FROM activity_heartbeats ah
JOIN user_profiles up ON up.id = ah.user_id
WHERE up.email = 'YOUR_EMAIL_HERE'

UNION ALL

SELECT
  'Daily Stats' as type,
  COUNT(*) as count
FROM daily_usage_stats dus
JOIN user_profiles up ON up.id = dus.user_id
WHERE up.email = 'YOUR_EMAIL_HERE';
