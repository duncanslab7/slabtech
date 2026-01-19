-- ============================================================================
-- Backfill daily_usage_stats FROM streak_activities
-- ============================================================================
-- This fixes the fact that audio listening wasn't tracked in daily_usage_stats
-- Creates minimal daily_usage_stats records so data is consistent
-- ============================================================================

-- STEP 1: Preview what will be created
SELECT
  sa.user_id,
  up.email,
  up.company_id,
  sa.activity_date AS date,
  2 AS total_active_minutes, -- Minimum threshold to earn streak
  1 AS session_count, -- Count each activity as a session
  sa.activity_type,
  'Will be created in daily_usage_stats' AS action
FROM streak_activities sa
JOIN user_profiles up ON up.id = sa.user_id
LEFT JOIN daily_usage_stats dus ON dus.user_id = sa.user_id AND dus.date = sa.activity_date
WHERE dus.id IS NULL -- Only create if doesn't exist
ORDER BY sa.user_id, sa.activity_date DESC;

-- ============================================================================
-- STEP 2: Actually create the missing daily_usage_stats records
-- ============================================================================
-- This creates minimal records (2 minutes active time) for days where
-- users had streak activities but no daily_usage_stats

INSERT INTO daily_usage_stats (
  user_id,
  company_id,
  date,
  total_active_minutes,
  session_count,
  transcript_views,
  audio_listen_minutes,
  uploads_count,
  first_activity,
  last_activity,
  created_at,
  updated_at
)
SELECT
  sa.user_id,
  up.company_id,
  sa.activity_date AS date,
  2 AS total_active_minutes, -- Minimum to earn streak
  1 AS session_count,
  CASE WHEN sa.activity_type = 'transcript_view' THEN 1 ELSE 0 END AS transcript_views,
  CASE WHEN sa.activity_type = 'audio_listen' THEN 2 ELSE 0 END AS audio_listen_minutes,
  CASE WHEN sa.activity_type = 'transcript_upload' THEN 1 ELSE 0 END AS uploads_count,
  sa.activity_date::TIMESTAMPTZ AS first_activity,
  sa.activity_date::TIMESTAMPTZ + INTERVAL '2 minutes' AS last_activity,
  sa.created_at,
  NOW() AS updated_at
FROM streak_activities sa
JOIN user_profiles up ON up.id = sa.user_id
LEFT JOIN daily_usage_stats dus ON dus.user_id = sa.user_id AND dus.date = sa.activity_date
WHERE dus.id IS NULL -- Only create if doesn't exist
ON CONFLICT (user_id, date) DO NOTHING; -- Safety check

-- STEP 3: For existing daily_usage_stats with 0 minutes but has streak_activities
-- Update them to have at least 2 minutes so they're consistent
UPDATE daily_usage_stats dus
SET
  total_active_minutes = GREATEST(dus.total_active_minutes, 2),
  audio_listen_minutes = GREATEST(dus.audio_listen_minutes, 2),
  updated_at = NOW()
FROM streak_activities sa
WHERE sa.user_id = dus.user_id
  AND sa.activity_date = dus.date
  AND dus.total_active_minutes < 2; -- Only update if below threshold

-- ============================================================================
-- STEP 4: Verify consistency now
-- ============================================================================
SELECT * FROM verify_analytics_consistency();
