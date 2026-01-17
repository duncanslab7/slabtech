# Final Setup Steps - Usage Tracking

You're almost there! Just follow these steps to get everything working.

## The Problem (What We Fixed)

- ✅ Database tables exist
- ✅ Functions exist
- ✅ API is recording heartbeats
- ❌ **BUT** daily stats weren't being aggregated automatically
- ❌ So dashboards showed all zeros

## The Solution

I've updated the code to **automatically aggregate stats** every time a heartbeat is sent. No more manual SQL!

---

## Step-by-Step: Get It Working

### Step 1: Aggregate Historical Data (One-Time)

You have heartbeats from 2026-01-16 and 2026-01-17 that were never aggregated. Run this SQL in Supabase **once**:

```sql
-- Fix all historical data
DO $$
DECLARE
  user_date_record RECORD;
  count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting aggregation...';

  FOR user_date_record IN
    SELECT DISTINCT
      user_id,
      DATE(heartbeat_at) as activity_date
    FROM activity_heartbeats
    ORDER BY activity_date DESC
  LOOP
    PERFORM update_daily_usage_stats(
      user_date_record.user_id,
      user_date_record.activity_date
    );
    count := count + 1;
  END LOOP;

  RAISE NOTICE '✅ Aggregated % user-days', count;
END $$;

-- Verify it worked
SELECT
  up.email,
  dus.date,
  dus.total_active_minutes,
  dus.session_count
FROM daily_usage_stats dus
JOIN user_profiles up ON up.id = dus.user_id
ORDER BY dus.date DESC;
```

**Expected Result:** Should show multiple rows with your email for different dates

---

### Step 2: Deploy Updated Code

The heartbeat API (`src/app/api/activity/heartbeat/route.ts`) now auto-aggregates stats.

```bash
# Build the app
npm run build

# Deploy (Vercel, or wherever you host)
vercel deploy --prod
# OR
git push  # if auto-deploy is set up
```

---

### Step 3: Test It Live

1. **Go to your app** (after deploying)
2. **Log in** as a user
3. **Browse around for 2 minutes** (this generates heartbeats)
4. **Go to `/usage-analytics`**
5. **You should see your data!**

---

### Step 4: Verify in Database (Optional)

Check that new data is being created:

```sql
-- Check recent heartbeats
SELECT
  up.email,
  ah.heartbeat_at,
  ah.activity_type
FROM activity_heartbeats ah
JOIN user_profiles up ON up.id = ah.user_id
ORDER BY ah.heartbeat_at DESC
LIMIT 10;

-- Check if daily stats are updating
SELECT
  up.email,
  dus.date,
  dus.total_active_minutes,
  dus.session_count,
  dus.updated_at
FROM daily_usage_stats dus
JOIN user_profiles up ON up.id = dus.user_id
ORDER BY dus.updated_at DESC
LIMIT 10;
```

**What to look for:**
- New heartbeats appearing as you browse
- `daily_usage_stats.updated_at` timestamp changing as you use the app
- `total_active_minutes` increasing

---

## How It Works Now (Automatic!)

### Before (Broken):
```
User browses → Heartbeat sent → Saved to DB → Dashboard shows zero ❌
                                             ↓
                                  (Never aggregated)
```

### After (Fixed):
```
User browses → Heartbeat sent → Saved to DB → Stats auto-aggregate → Dashboard updates ✅
                                             ↓
                                  (Every 30 seconds!)
```

---

## Future Usage

From now on:
- **Just use the app normally** - tracking happens automatically
- **Check dashboards anytime** - data is always current
- **No manual SQL needed** - everything is automated

---

## Dashboards You Can Use

### For Super Admins:
- `/usage-analytics` - See all users across all companies

### For Company Admins:
- `/c/[company-slug]/usage` - See users in their company only

### For Individual User Details:
- `/users/[user-id]/usage` - Detailed breakdown per user

---

## Troubleshooting

### "I deployed but still see zeros"

1. **Did you run Step 1?** Historical data needs one-time aggregation
2. **Did you deploy the changes?** The updated API code must be live
3. **Are heartbeats being sent?** Check browser console for errors
4. **Hard refresh the dashboard:** Press Ctrl+Shift+R (clears cache)

### "Data updates slowly"

- Stats aggregate every 30 seconds (when heartbeats are sent)
- If you want real-time updates, refresh the dashboard page
- Or I can add auto-refresh to the dashboard (optional)

---

## Success Checklist

- [ ] Run Step 1 SQL to fix historical data
- [ ] Deploy updated code
- [ ] Test by browsing app for 2 minutes
- [ ] Check `/usage-analytics` dashboard
- [ ] See non-zero numbers! 🎉

---

## Need Help?

If you still don't see data after following these steps:

1. Check browser console for errors (F12)
2. Run the diagnostic SQL again
3. Send me screenshots of:
   - Browser console
   - Latest daily_usage_stats query results
   - Dashboard showing zeros

---

**You're ready to go! Run Step 1, deploy, and test it out!** 🚀
