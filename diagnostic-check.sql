-- ============================================================================
-- Database Diagnostic Check
-- Run this BEFORE the migration to understand current state
-- ============================================================================

-- 1. Check if user_profiles table exists and its columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 2. Check if company_id already exists on any tables
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name = 'company_id';

-- 3. Check existing policies on user_profiles
SELECT policyname, policycmd, qual::text as using_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_profiles';

-- 4. Check existing policies on companies (if table exists)
SELECT policyname, policycmd, qual::text as using_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'companies';

-- 5. Check if messages table already exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'messages'
) as messages_exists;

-- 6. Check login_logs columns (to verify user_id column name)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'login_logs';

-- 7. Check for any views that reference user_profiles
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND view_definition LIKE '%user_profiles%';

-- 8. Check existing check constraints on user_profiles
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.user_profiles'::regclass
AND contype = 'c';
