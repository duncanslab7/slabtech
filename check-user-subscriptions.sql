-- ============================================================================
-- DIAGNOSTIC: Check if users have salesperson subscriptions
-- ============================================================================
-- Run this to see if your test user actually has subscriptions set up
-- ============================================================================

-- 1. Show ALL subscriptions (as super admin, bypassing RLS temporarily)
SELECT
  'All Subscriptions (Super Admin View)' AS check_type,
  ss.id,
  ss.user_id,
  up.email AS user_email,
  up.display_name AS user_name,
  ss.salesperson_name,
  ss.created_at
FROM salesperson_subscriptions ss
LEFT JOIN user_profiles up ON up.id = ss.user_id
ORDER BY ss.created_at DESC
LIMIT 20;

-- 2. Count subscriptions per user
SELECT
  'Subscriptions Per User' AS check_type,
  up.email,
  up.display_name,
  COUNT(ss.id) AS subscription_count,
  STRING_AGG(ss.salesperson_name, ', ') AS subscribed_salespeople
FROM user_profiles up
LEFT JOIN salesperson_subscriptions ss ON ss.user_id = up.id
GROUP BY up.id, up.email, up.display_name
HAVING COUNT(ss.id) > 0
ORDER BY subscription_count DESC;

-- 3. Show available salespeople in transcripts
SELECT
  'Available Salespeople' AS check_type,
  salesperson_name,
  COUNT(*) AS transcript_count
FROM transcripts
WHERE salesperson_name IS NOT NULL
GROUP BY salesperson_name
ORDER BY transcript_count DESC;

-- 4. Test as specific user (replace with actual user email)
-- Uncomment and modify this query:
/*
SELECT
  'Specific User Subscriptions' AS check_type,
  ss.*
FROM salesperson_subscriptions ss
WHERE ss.user_id = (
  SELECT id FROM user_profiles WHERE email = 'user@example.com'
);
*/

-- ============================================================================
-- If users have 0 subscriptions, you need to CREATE them first!
-- See the API endpoints in src/app/api/admin/users/[id]/subscriptions/
-- ============================================================================
