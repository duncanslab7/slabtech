-- Verify RLS is actually disabled

SELECT
  tablename,
  rowsecurity as "RLS Enabled (should be false)"
FROM pg_tables
WHERE tablename IN ('user_activity_events', 'daily_usage_stats')
ORDER BY tablename;

-- If RLS is still enabled, disable it now
ALTER TABLE user_activity_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage_stats DISABLE ROW LEVEL SECURITY;

-- Verify again
SELECT
  tablename,
  rowsecurity as "RLS Enabled (should be false NOW)"
FROM pg_tables
WHERE tablename IN ('user_activity_events', 'daily_usage_stats')
ORDER BY tablename;
