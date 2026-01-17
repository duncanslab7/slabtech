-- Check current RLS policies on activity tracking tables

SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('user_activity_events', 'daily_usage_stats')
ORDER BY tablename, policyname;
