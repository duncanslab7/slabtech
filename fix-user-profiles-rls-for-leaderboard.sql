-- Fix RLS policy to allow users to see other profiles in their company
-- This is needed for the company leaderboard to work

-- Drop the old policy
DROP POLICY IF EXISTS "Users can read profiles" ON user_profiles;

-- Create new policy that allows users to see profiles in their company
CREATE POLICY "Users can read profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (
  -- Super admins can see all
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'super_admin')
  -- Users can see their own profile
  OR id = auth.uid()
  -- Company admins can see all in their company
  OR company_id IN (
    SELECT company_id FROM user_profiles
    WHERE id = auth.uid() AND role = 'company_admin'
  )
  -- Regular users can see other users in the same company (NEW!)
  OR company_id IN (
    SELECT company_id FROM user_profiles
    WHERE id = auth.uid()
  )
);
