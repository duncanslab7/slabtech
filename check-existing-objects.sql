-- Check for existing policies on user_profiles
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'user_profiles';

-- Check for existing policies on companies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'companies';

-- Check for views that might reference user_profiles
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND view_definition LIKE '%user_profiles%';

-- Check for functions that might reference user_profiles
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition LIKE '%user_profiles%';
