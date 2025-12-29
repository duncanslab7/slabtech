-- Check the user's profile and company assignment
-- Run this in your Supabase SQL Editor

SELECT
  up.id,
  up.email,
  up.role,
  up.company_id,
  up.is_active,
  c.id as company_id_from_join,
  c.name as company_name,
  c.slug as company_slug
FROM user_profiles up
LEFT JOIN companies c ON up.company_id = c.id
WHERE up.email = 'duncangrant04@gmail.com';

-- If company_id is NULL, you need to assign this user to a company
-- If you need to assign them to a company, run:
-- UPDATE user_profiles
-- SET company_id = 'YOUR-COMPANY-UUID-HERE'
-- WHERE email = 'duncangrant04@gmail.com';

-- To find available companies:
-- SELECT id, name, slug FROM companies;
