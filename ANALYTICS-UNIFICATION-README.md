# Analytics Unification Guide

## Problem Summary

You had three separate analytics systems showing different numbers:

1. **Usage Analytics** (Superadmin → Usage tab)
   - Data source: `daily_usage_stats` aggregated from `activity_heartbeats`
   - Showed: Active time, sessions, days active

2. **Leaderboard** (Company view)
   - Data source: `user_streaks` updated from manual `streak_activities` inserts
   - Showed: Current streak, best streak
   - **Issue**: Only showed users who manually triggered `/api/streak` POST

3. **User Management** (Superadmin → Users tab)
   - Data source: `login_logs`
   - Showed: Login counts, unique login days
   - **Issue**: Only counted explicit login events, not actual app usage

### Why They Didn't Match

- **Usage Analytics** tracked heartbeats (browser activity)
- **Leaderboard** tracked manual activity events (required code to call `/api/streak`)
- **User Management** tracked login events only

A user could:
- Have active browser time → Shows in Usage Analytics
- Not trigger streak API → Missing from Leaderboard
- Not re-login → Shows 0 logins in User Management

## Solution

**Single Source of Truth**: `daily_usage_stats`

**New Rules**:
- User has **2+ minutes of active time** in a day → Automatically earns a streak
- All three systems now pull from the same underlying data
- Leaderboard shows **ALL active users**, even those with 0 streaks
- User Management shows **days active** (unified metric) instead of just login counts

## Files Created

### 1. `analytics-unification-migration.sql`
**What it does**:
- Creates automatic syncing: `daily_usage_stats` → `streak_activities`
- Updates `user_login_stats` view to show unified days active
- Updates `company_streak_leaderboard` view to include all users
- Backfills all historical data
- Adds verification function

**Run this in**: Supabase SQL Editor

### 2. `verify-analytics-consistency.sql`
**What it does**:
- Tests if all three systems show the same data
- Shows before/after comparison
- Identifies specific inconsistencies

**Run this**: Before AND after the migration to see the fix

### 3. Updated Files:
- `src/app/api/company/[slug]/leaderboard/route.ts` - Now uses unified view
- `src/app/(admin)/usage-analytics/page.tsx` - Added consistency badge

## Step-by-Step Migration

### ⚠️ IMPORTANT: Backup First
```bash
# In Supabase Dashboard:
# 1. Go to Database → Backups
# 2. Create a manual backup before proceeding
```

### Step 1: Verify Current State (BEFORE)

Run in Supabase SQL Editor:
```sql
\i verify-analytics-consistency.sql
```

**Expected Output**: Many users showing "✗ Mismatch"

### Step 2: Run the Migration

Run in Supabase SQL Editor:
```sql
\i analytics-unification-migration.sql
```

**What happens**:
- Creates new database functions
- Creates triggers for automatic syncing
- Backfills historical `streak_activities` from `daily_usage_stats`
- Updates all views to use unified data source

**Expected Duration**: 30-60 seconds depending on data size

### Step 3: Verify Fixed State (AFTER)

Run again in Supabase SQL Editor:
```sql
\i verify-analytics-consistency.sql
```

**Expected Output**: All users showing "✓ Consistent"

### Step 4: Deploy Frontend Changes

```bash
# From your SLAB directory:
git add .
git commit -m "Unify analytics data sources across all views"
git push

# If using Vercel, this will auto-deploy
# Otherwise, deploy manually to your hosting platform
```

### Step 5: Set Up Daily Sync (Optional but Recommended)

If you have access to pg_cron or similar, schedule this to run daily:

```sql
-- Run this daily at 2 AM to process previous day's data
SELECT cron.schedule(
  'sync-daily-usage-to-streaks',
  '0 2 * * *',  -- 2 AM every day
  $$SELECT sync_daily_stats_to_streaks()$$
);
```

**Note**: The trigger on `daily_usage_stats` already handles real-time syncing, so this cron job is just a safety net for any edge cases.

## How It Works Now

### When User Visits App:

1. **Session starts** → Creates `user_sessions` record
2. **Heartbeats fire** → Inserts into `activity_heartbeats` table (every ~30 sec)
3. **Session ends** → Calls `update_daily_usage_stats()`
4. **`daily_usage_stats` updated** → Calculates active minutes from heartbeats
5. **Trigger fires automatically** → If `total_active_minutes >= 2`, creates `streak_activities` record
6. **`streak_activities` insert** → Triggers `update_user_streak()` function
7. **`user_streaks` updated** → Recalculates current/longest streak

### All Three Systems Now Show:

| System | Data Source | Metric Shown | Status |
|--------|-------------|--------------|--------|
| Usage Analytics | `daily_usage_stats` | Days active (last 7/30 days) | ✓ Unified |
| User Management | `daily_usage_stats` via `user_login_stats` view | Unique days active | ✓ Unified |
| Leaderboard | `user_streaks` ← `streak_activities` ← `daily_usage_stats` | Current/longest streak | ✓ Unified |

## Verification Commands

### Check overall consistency:
```sql
SELECT * FROM verify_analytics_consistency();
```

### Check specific user:
```sql
SELECT * FROM verify_analytics_consistency('duncan@slabtraining.com');
```

### Check consistency percentage:
```sql
WITH consistency_check AS (
  SELECT * FROM verify_analytics_consistency()
)
SELECT
  COUNT(*) FILTER (WHERE status = '✓ Consistent') AS consistent_users,
  COUNT(*) FILTER (WHERE status = '✗ Mismatch') AS mismatched_users,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = '✓ Consistent') / NULLIF(COUNT(*), 0),
    2
  ) AS consistency_percentage
FROM consistency_check;
```

**Target**: 100% consistency

### View a specific user's data across all systems:
```sql
SELECT
  up.email,

  -- Usage Analytics
  uus.days_active_last_7,
  uus.last_7_days_active_minutes,

  -- User Management
  uls.unique_days_logged_in,
  uls.logins_last_7_days,

  -- Leaderboard
  us.current_streak,
  us.longest_streak

FROM user_profiles up
LEFT JOIN user_usage_summary uus ON uus.user_id = up.id
LEFT JOIN user_login_stats uls ON uls.user_id = up.id
LEFT JOIN user_streaks us ON us.user_id = up.id
WHERE up.email = 'duncan@slabtraining.com';
```

## Troubleshooting

### Q: Some users still show 0 streaks but have activity
**A**: Run the backfill again:
```sql
SELECT * FROM backfill_streak_activities_from_usage_stats();
```

### Q: Data looks correct in database but not on frontend
**A**: Clear browser cache and hard refresh (Ctrl+Shift+R)

### Q: How do I manually trigger streak sync for a specific date?
**A**: The `sync_daily_stats_to_streaks()` function processes yesterday by default. For other dates, you'd need to modify the function temporarily or insert directly:
```sql
INSERT INTO streak_activities (user_id, company_id, activity_date, activity_type)
SELECT
  user_id,
  company_id,
  date,
  'daily_active'
FROM daily_usage_stats
WHERE date = '2026-01-15'  -- Specific date
  AND total_active_minutes >= 2
ON CONFLICT DO NOTHING;
```

### Q: Can I change the 2-minute threshold?
**A**: Yes! Edit the migration file and change both instances:
- Line 26: `AND dus.total_active_minutes >= 2`
- Line 47: `IF NEW.total_active_minutes >= 2 THEN`

Then re-run the migration and backfill.

### Q: Will this affect existing user data?
**A**: No! The backfill is additive only - it creates missing `streak_activities` records but doesn't delete or modify existing ones.

## What Changed

### Database Changes:
- ✅ New function: `sync_daily_stats_to_streaks()`
- ✅ New function: `backfill_streak_activities_from_usage_stats()`
- ✅ New function: `verify_analytics_consistency()`
- ✅ New trigger: `trigger_auto_sync_streaks` on `daily_usage_stats`
- ✅ New trigger function: `trigger_sync_streaks_on_daily_stats()`
- ✅ Updated view: `user_login_stats` (now shows days active instead of login count)
- ✅ Updated view: `company_streak_leaderboard` (now includes all active users)

### Frontend Changes:
- ✅ Leaderboard API route simplified (uses unified view)
- ✅ Usage Analytics page shows consistency badge

### No Changes Needed:
- ❌ `daily_usage_stats` table (already the source of truth)
- ❌ `user_streaks` table (still stores streak state)
- ❌ `streak_activities` table (now auto-populated)
- ❌ `login_logs` table (kept for audit trail)

## Rollback Plan

If something goes wrong:

### 1. Restore Database Backup
In Supabase Dashboard:
- Database → Backups → Select your pre-migration backup → Restore

### 2. Revert Frontend Changes
```bash
git revert HEAD
git push
```

## Success Criteria

After migration, all of the following should be true:

- [ ] `verify_analytics_consistency()` shows 100% consistency
- [ ] Usage Analytics shows same "days active" as User Management
- [ ] Leaderboard shows all active users (including those with 0 streaks)
- [ ] Leaderboard streaks match "days active last 7" in Usage Analytics
- [ ] Users with 2+ min active time in `daily_usage_stats` have corresponding `streak_activities` records
- [ ] All three views show matching numbers in screenshots

## Testing Checklist

After migration:

1. **Usage Analytics Page** (Superadmin → Usage)
   - [ ] Shows users with their days active
   - [ ] Numbers look reasonable (not all 0s or inflated)
   - [ ] Green badge visible: "✓ Unified Analytics..."

2. **User Management Page** (Superadmin → Users)
   - [ ] "Unique days logged in" matches Usage Analytics
   - [ ] Numbers consistent with leaderboard streaks

3. **Leaderboard** (Company view)
   - [ ] All active users appear (not just top performers)
   - [ ] Users with 0 streaks show "0 days" instead of disappearing
   - [ ] Top users' streaks match their "days active last 7" in Usage Analytics

4. **Database Verification**
   - [ ] Run `SELECT * FROM verify_analytics_consistency();`
   - [ ] All users show "✓ Consistent"

## Support

If you encounter issues:

1. Check the verification queries above
2. Review the Supabase logs for errors
3. Take screenshots of the inconsistent data
4. Run the consistency verification with specific user email

## Next Steps

Optional improvements you could make:

1. **Add more activity types**: Modify `trigger_sync_streaks_on_daily_stats()` to check other metrics
2. **Adjust threshold**: Change the 2-minute threshold to match your usage patterns
3. **Add notifications**: Send users emails when they break their streak
4. **Leaderboard history**: Track historical leaderboard positions

---

**Created**: 2026-01-19
**Author**: Claude (via Duncan's request)
**Purpose**: Unify SLAB's analytics systems to show consistent data across all views
