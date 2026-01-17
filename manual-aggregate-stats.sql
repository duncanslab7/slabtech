-- ============================================================================
-- Manual Stats Aggregation
-- ============================================================================
-- The daily_usage_stats table is NOT automatically updated in real-time
-- You need to run this to aggregate heartbeat data into daily stats
-- ============================================================================

-- Option 1: Update stats for TODAY for all users with activity
DO $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Aggregating stats for today...';

  FOR user_record IN
    SELECT DISTINCT user_id
    FROM activity_heartbeats
    WHERE heartbeat_at >= CURRENT_DATE
  LOOP
    PERFORM update_daily_usage_stats(user_record.user_id, CURRENT_DATE);
    updated_count := updated_count + 1;
  END LOOP;

  RAISE NOTICE '✅ Updated daily stats for % users', updated_count;
END $$;

-- Option 2: Update stats for the last 7 days for all users
DO $$
DECLARE
  user_record RECORD;
  date_record DATE;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Aggregating stats for last 7 days...';

  -- For each day in the last 7 days
  FOR date_record IN
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '7 days',
      CURRENT_DATE,
      '1 day'::interval
    )::date AS date
  LOOP
    -- For each user with activity on that day
    FOR user_record IN
      SELECT DISTINCT user_id
      FROM activity_heartbeats
      WHERE heartbeat_at >= date_record::timestamptz
        AND heartbeat_at < (date_record + INTERVAL '1 day')::timestamptz
    LOOP
      PERFORM update_daily_usage_stats(user_record.user_id, date_record);
      updated_count := updated_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Updated daily stats for % user-days', updated_count;
END $$;

-- Option 3: Quick check - show what will be aggregated
SELECT
  user_id,
  DATE(heartbeat_at) as date,
  COUNT(*) as heartbeat_count,
  MIN(heartbeat_at) as first_heartbeat,
  MAX(heartbeat_at) as last_heartbeat
FROM activity_heartbeats
WHERE heartbeat_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY user_id, DATE(heartbeat_at)
ORDER BY date DESC, user_id;

-- After running Option 1 or 2, verify the data:
SELECT
  dus.user_id,
  up.email,
  dus.date,
  dus.total_active_minutes,
  dus.session_count
FROM daily_usage_stats dus
JOIN user_profiles up ON up.id = dus.user_id
ORDER BY dus.date DESC, up.email
LIMIT 20;
