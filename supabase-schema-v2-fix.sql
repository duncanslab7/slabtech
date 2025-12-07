-- ============================================================================
-- SLAB Voice Database Schema v2 - FIX for RLS Infinite Recursion
-- ============================================================================
-- Run this to fix the infinite recursion issue in user_profiles policies
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can read all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON user_profiles;

-- Create simpler policies that don't cause recursion
-- Allow all authenticated users to read their own profile
CREATE POLICY "Users can read own profile"
ON user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow all authenticated users to insert their own profile (for auto-creation)
CREATE POLICY "Users can create own profile"
ON user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Only allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Disable RLS for service role operations (backend will handle permissions)
-- The API routes will check roles in code instead of using RLS
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

-- Create a function to check if a user is an admin (for use in policies)
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Note: We're relying on the API to enforce admin permissions
-- rather than using RLS policies that cause recursion
