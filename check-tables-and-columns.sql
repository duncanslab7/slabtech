-- ============================================================================
-- Diagnostic: Check which tables exist and which have company_id
-- ============================================================================

-- 1. Which tables exist?
SELECT
  table_name,
  CASE WHEN table_name IN ('user_profiles','transcripts','salespeople','login_logs','user_streaks','streak_activities','messages','company_invites','companies')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_profiles','transcripts','salespeople','login_logs','user_streaks','streak_activities','messages','company_invites','companies')
ORDER BY table_name;

-- 2. Check company_id column on each table
SELECT
  'user_profiles' as table_name,
  COALESCE(column_name, 'MISSING') as column_status,
  data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='user_profiles'
  AND column_name='company_id'
UNION ALL
SELECT
  'transcripts' as table_name,
  COALESCE(column_name, 'MISSING') as column_status,
  data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='transcripts'
  AND column_name='company_id'
UNION ALL
SELECT
  'salespeople' as table_name,
  COALESCE(column_name, 'MISSING') as column_status,
  data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='salespeople'
  AND column_name='company_id'
UNION ALL
SELECT
  'login_logs' as table_name,
  COALESCE(column_name, 'MISSING') as column_status,
  data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='login_logs'
  AND column_name='company_id'
UNION ALL
SELECT
  'companies' as table_name,
  'id' as column_status,
  data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='companies'
  AND column_name='id';

-- 3. Check all columns on user_profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 4. Check for existing constraints on user_profiles
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.user_profiles'::regclass;

-- 5. Check existing views that might reference these tables
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND (
  view_definition LIKE '%user_profiles%' OR
  view_definition LIKE '%company%' OR
  view_definition LIKE '%streak%'
);
