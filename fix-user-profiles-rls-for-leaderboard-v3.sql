-- Fix RLS policy to allow users to see other profiles in their company
-- This version uses a security definer function to avoid infinite recursion

-- First, create a helper function that gets a user's company_id
-- SECURITY DEFINER means it runs with elevated privileges, bypassing RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid();
$$;

-- Now drop the old policy
DROP POLICY IF EXISTS "Users can read profiles" ON user_profiles;

-- Create new policy that uses the helper function (no recursion!)
CREATE POLICY "Users can read profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (
  -- Super admins can see all
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'super_admin')
  -- Users can see their own profile
  OR id = auth.uid()
  -- Users can see other users in the same company
  OR company_id = public.get_user_company_id()
);
