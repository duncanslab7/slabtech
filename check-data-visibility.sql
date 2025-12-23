-- Check what data exists and why it might be hidden

-- 1. Check your user info
SELECT
  id,
  email,
  role,
  company_id,
  is_active
FROM user_profiles
WHERE id = auth.uid();

-- 2. Check helper functions
SELECT
  public.current_user_role() as my_role,
  public.current_user_company_id() as my_company;

-- 3. Count all salespeople (bypass RLS using service role or check raw data)
SELECT COUNT(*) as total_salespeople FROM salespeople;

-- 4. Count salespeople by company
SELECT company_id, COUNT(*) as count
FROM salespeople
GROUP BY company_id;

-- 5. Count transcripts by company
SELECT company_id, COUNT(*) as count
FROM transcripts
GROUP BY company_id;

-- 6. Check if your company matches the data
SELECT
  'Your company' as info,
  (SELECT company_id FROM user_profiles WHERE id = auth.uid()) as your_company,
  (SELECT company_id FROM salespeople LIMIT 1) as salespeople_company,
  (SELECT company_id FROM transcripts LIMIT 1) as transcripts_company;
