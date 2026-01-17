-- ============================================================================
-- CLEANUP SCRIPT - Usage Tracking Tables
-- ============================================================================
-- Run this FIRST to remove any existing tracking tables/functions
-- Then run the main migration fresh
-- ============================================================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS user_usage_summary CASCADE;
DROP VIEW IF EXISTS company_usage_summary CASCADE;
DROP VIEW IF EXISTS weekly_usage_stats CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_old_heartbeats() CASCADE;
DROP FUNCTION IF EXISTS update_daily_usage_stats(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS calculate_active_minutes(UUID, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS record_activity_heartbeat(UUID, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS end_user_session(UUID) CASCADE;
DROP FUNCTION IF EXISTS start_user_session(UUID, TEXT, TEXT) CASCADE;

-- Drop tables (in order to avoid foreign key issues)
DROP TABLE IF EXISTS user_activity_events CASCADE;
DROP TABLE IF EXISTS daily_usage_stats CASCADE;
DROP TABLE IF EXISTS activity_heartbeats CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;

-- Confirm cleanup
DO $$
BEGIN
  RAISE NOTICE '✅ All usage tracking tables, functions, and views have been dropped';
END $$;
