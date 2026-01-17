-- Automatically mark sessions as ended if no heartbeat in last 5 minutes
-- This fixes the "sessions never end" problem

-- Update sessions where:
-- 1. Session is marked as active (is_active = true)
-- 2. Session has no end time (session_end IS NULL)
-- 3. Last heartbeat was more than 5 minutes ago

UPDATE user_sessions us
SET
  session_end = last_heartbeat.last_beat,
  is_active = false,
  updated_at = NOW()
FROM (
  SELECT
    session_id,
    MAX(heartbeat_at) as last_beat
  FROM activity_heartbeats
  GROUP BY session_id
) as last_heartbeat
WHERE us.id = last_heartbeat.session_id
  AND us.is_active = true
  AND us.session_end IS NULL
  AND last_heartbeat.last_beat < NOW() - INTERVAL '5 minutes';

-- Show updated sessions
SELECT
  up.email,
  us.session_start,
  us.session_end,
  us.is_active,
  EXTRACT(EPOCH FROM (us.session_end - us.session_start))/60 as duration_minutes
FROM user_sessions us
JOIN user_profiles up ON up.id = us.user_id
WHERE us.session_end IS NOT NULL
ORDER BY us.session_start DESC
LIMIT 10;
