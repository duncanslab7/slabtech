# Database Setup Instructions

You're seeing errors because the new database tables haven't been created yet. Follow these steps:

## Step 1: Run the Database Migration

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Click on your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `supabase-schema-v2.sql`
6. Click **Run** (or press Ctrl+Enter)

## Step 2: Set Up Your Admin Account

After running the migration, make yourself an admin by running this SQL (replace with your email):

```sql
INSERT INTO user_profiles (id, email, display_name, role)
SELECT id, email, email, 'admin'
FROM auth.users
WHERE email = 'duncangrant04@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

## Expected Results

After running the migration, you should have these new tables:
- `user_profiles` - User information and roles
- `login_logs` - Login tracking for security
- `transcript_assignments` - Which users can see which transcripts
- `user_login_stats` - View for admin dashboard showing login statistics

## Troubleshooting

If you see errors like "table already exists", that's okay - it means part of the migration was already run.

If you see "Forbidden" when creating users, the migration hasn't been run successfully yet.

## After Setup

Once the migration is complete:
1. Refresh the admin page
2. You should now be able to create new users
3. New users will automatically get profiles created when they sign up
