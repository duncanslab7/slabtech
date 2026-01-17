-- Check if RLS is enabled on activity tracking tables

SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename IN (
  'user_activity_events',
  'daily_usage_stats',
  'activity_heartbeats',
  'user_sessions'
)
ORDER BY tablename;
