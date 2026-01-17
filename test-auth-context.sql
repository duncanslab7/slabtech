-- Test if auth.uid() is working correctly
-- Run this while logged in to see what user context you have

SELECT
  auth.uid() as "Current auth.uid()",
  auth.role() as "Current auth.role()";

-- Also check your user profile
SELECT
  id as "user_profiles.id",
  email,
  role,
  company_id
FROM user_profiles
WHERE id = auth.uid();
