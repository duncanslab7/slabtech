-- Simplest possible RLS policy - no recursion at all
-- This allows users to see profiles in their company for the leaderboard

-- Drop the old policy
DROP POLICY IF EXISTS "Users can read profiles" ON user_profiles;

-- Create the simplest policy that works
CREATE POLICY "Users can read profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (
  -- Option 1: User is viewing their own profile
  id = auth.uid()
  -- Option 2: User has super_admin role (uses helper function)
  OR public.get_user_role() = 'super_admin'
  -- Option 3: User is in the same company (uses helper function)
  OR (
    company_id IS NOT NULL
    AND public.get_user_company_id() IS NOT NULL
    AND company_id = public.get_user_company_id()
  )
);
