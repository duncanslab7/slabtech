-- ============================================================================
-- Migration Verification Queries
-- ============================================================================

-- 1. Check that companies table exists and has data
SELECT 'Companies table' as check_name, COUNT(*) as count,
  STRING_AGG(name, ', ') as company_names
FROM companies;

-- 2. Check that all tables have company_id column
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'company_id'
  AND table_name IN ('user_profiles', 'transcripts', 'salespeople', 'login_logs', 'user_streaks', 'streak_activities', 'messages', 'company_invites')
ORDER BY table_name;

-- 3. Check that all users are assigned to a company
SELECT
  'Users without company' as check_name,
  COUNT(*) as count
FROM user_profiles
WHERE company_id IS NULL;

-- 4. Check user role distribution
SELECT
  role,
  COUNT(*) as user_count
FROM user_profiles
GROUP BY role
ORDER BY user_count DESC;

-- 5. Check that default company was created
SELECT
  id,
  name,
  slug,
  is_active,
  created_at
FROM companies
WHERE slug = 'slab-internal';

-- 6. Check that RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'user_profiles', 'transcripts', 'salespeople', 'login_logs', 'user_streaks', 'streak_activities', 'messages', 'company_invites')
ORDER BY tablename;

-- 7. Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'user_profiles', 'transcripts', 'salespeople', 'login_logs', 'user_streaks', 'streak_activities', 'messages', 'company_invites')
GROUP BY tablename
ORDER BY tablename;

-- 8. Check that views were recreated
SELECT
  table_name,
  CASE
    WHEN table_name = 'user_login_stats' THEN '✓ Recreated'
    WHEN table_name = 'company_streak_leaderboard' THEN '✓ Created'
    ELSE 'Unknown'
  END as status
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('user_login_stats', 'company_streak_leaderboard')
ORDER BY table_name;

-- 9. Check sample data - are existing records assigned to default company?
SELECT
  'Transcripts with company' as table_name,
  COUNT(*) as count
FROM transcripts
WHERE company_id IS NOT NULL
UNION ALL
SELECT
  'Salespeople with company' as table_name,
  COUNT(*) as count
FROM salespeople
WHERE company_id IS NOT NULL
UNION ALL
SELECT
  'Users with company' as table_name,
  COUNT(*) as count
FROM user_profiles
WHERE company_id IS NOT NULL;

-- 10. Check that trigger was recreated
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'on_auth_user_created';
