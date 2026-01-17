-- TEMPORARY: Disable RLS on activity tracking tables to get tracking working
-- We'll fix the policies properly later

ALTER TABLE user_activity_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage_stats DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename IN ('user_activity_events', 'daily_usage_stats');
