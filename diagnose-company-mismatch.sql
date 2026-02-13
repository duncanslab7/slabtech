-- ============================================================================
-- DIAGNOSE: Check if transcripts and users are in the same company
-- ============================================================================

-- 1. Show which company the "Rylan" transcripts belong to
SELECT
  'Rylan Transcripts Companies' AS check_type,
  company_id,
  COUNT(*) AS transcript_count,
  c.name AS company_name,
  c.slug AS company_slug
FROM transcripts t
LEFT JOIN companies c ON c.id = t.company_id
WHERE salesperson_name = 'Rylan'
GROUP BY company_id, c.name, c.slug;

-- 2. Show which companies the subscribed users belong to
SELECT
  'Subscribed Users Companies' AS check_type,
  up.company_id,
  COUNT(DISTINCT up.id) AS user_count,
  c.name AS company_name,
  c.slug AS company_slug,
  STRING_AGG(DISTINCT up.email, ', ') AS user_emails
FROM salesperson_subscriptions ss
JOIN user_profiles up ON up.id = ss.user_id
LEFT JOIN companies c ON c.id = up.company_id
WHERE ss.salesperson_name = 'Rylan'
GROUP BY up.company_id, c.name, c.slug;

-- 3. Check for company mismatch (this is the problem!)
SELECT
  'Company Mismatch Check' AS check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM transcripts t
      WHERE t.salesperson_name = 'Rylan'
      AND t.company_id NOT IN (
        SELECT DISTINCT up.company_id
        FROM salesperson_subscriptions ss
        JOIN user_profiles up ON up.id = ss.user_id
        WHERE ss.salesperson_name = 'Rylan'
      )
    ) THEN 'MISMATCH: Transcripts in different company than users!'
    ELSE 'OK: Transcripts and users in same company'
  END AS diagnosis;

-- 4. Show a sample user and what they should be able to see
-- Pick the first user subscribed to Rylan
SELECT
  'Sample User Test' AS check_type,
  up.email,
  up.company_id AS user_company_id,
  c.name AS user_company_name,
  (SELECT COUNT(*) FROM transcripts WHERE salesperson_name = 'Rylan') AS total_rylan_transcripts,
  (SELECT COUNT(*) FROM transcripts WHERE salesperson_name = 'Rylan' AND company_id = up.company_id) AS rylan_transcripts_in_user_company
FROM user_profiles up
LEFT JOIN companies c ON c.id = up.company_id
WHERE up.id IN (
  SELECT user_id FROM salesperson_subscriptions WHERE salesperson_name = 'Rylan' LIMIT 1
);

-- ============================================================================
-- If diagnosis shows MISMATCH, the transcripts are in a different company!
-- Users can only see transcripts in THEIR company, even with subscriptions.
-- ============================================================================
