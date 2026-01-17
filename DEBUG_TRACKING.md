# Debugging Usage Tracking System

Follow these steps in order to identify the issue:

## Step 1: Check Browser Console for Errors

1. Open your browser DevTools (F12)
2. Go to the **Console** tab
3. Refresh the page after logging in
4. Look for any red errors related to:
   - "Failed to create session"
   - "Failed to send heartbeat"
   - "Failed to track event"
   - Any 401/403/500 errors

**What to look for:**
- JavaScript errors in the useActivityTracking hook
- Network errors from API calls
- Permission/CORS errors

Copy any errors you see here for analysis.

---

## Step 2: Check Network Tab for API Calls

1. Open DevTools → **Network** tab
2. Filter by "Fetch/XHR"
3. Refresh the page and wait 30 seconds
4. Look for these API calls:
   - `POST /api/activity/session` (should happen on page load)
   - `POST /api/activity/heartbeat` (should happen every 30 seconds)
   - `POST /api/activity/event` (should happen on page changes)

**Click on each request and check:**
- **Status Code**: Should be 200, if it's 401/403/500, there's an issue
- **Response**: Check what error message is returned
- **Request Payload**: Verify the data being sent

---

## Step 3: Verify Database Tables Exist

Run this in your Supabase SQL Editor:

```sql
-- Check if all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_sessions',
    'activity_heartbeats',
    'daily_usage_stats',
    'user_activity_events'
  )
ORDER BY table_name;
```

**Expected Result:** Should show all 4 tables
**If tables are missing:** Re-run the migration SQL

---

## Step 4: Check Database Functions Exist

```sql
-- Check if functions were created
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'start_user_session',
    'end_user_session',
    'record_activity_heartbeat',
    'update_daily_usage_stats',
    'calculate_active_minutes'
  )
ORDER BY routine_name;
```

**Expected Result:** Should show all 5 functions
**If functions are missing:** Re-run the migration SQL

---

## Step 5: Test Manual Session Creation

Try creating a session manually in Supabase SQL Editor:

```sql
-- Get your user ID first
SELECT id, email FROM auth.users LIMIT 5;

-- Then create a test session (replace USER_UUID with your actual ID)
SELECT start_user_session(
  'YOUR_USER_UUID_HERE'::uuid,
  '127.0.0.1',
  'test-browser'
);
```

**Expected Result:** Should return a UUID (the session ID)
**If it fails:** Check the error message - likely RLS policy issue

---

## Step 6: Check RLS Policies

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_sessions', 'activity_heartbeats', 'daily_usage_stats', 'user_activity_events');

-- Check what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_sessions', 'activity_heartbeats', 'daily_usage_stats', 'user_activity_events')
ORDER BY tablename, policyname;
```

**Common Issue:** If policies exist but are blocking inserts, you may need to adjust them.

---

## Step 7: Test API Endpoints Directly

Open your browser console and run this JavaScript:

```javascript
// Test session creation
fetch('/api/activity/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(d => console.log('Session response:', d))
.catch(e => console.error('Session error:', e));
```

**Expected Result:** Should log `{ sessionId: "some-uuid" }`
**If it fails:** Check the error message

Then test heartbeat (replace SESSION_ID):

```javascript
// Test heartbeat (use sessionId from above)
fetch('/api/activity/heartbeat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'YOUR_SESSION_ID_HERE',
    pagePath: '/test',
    activityType: 'page_active',
    metadata: {}
  })
})
.then(r => r.json())
.then(d => console.log('Heartbeat response:', d))
.catch(e => console.error('Heartbeat error:', e));
```

---

## Step 8: Verify ActivityTrackingProvider is Active

Add this temporary console.log to check if the hook is running:

Open `src/hooks/useActivityTracking.ts` and add at the top of the hook:

```typescript
export function useActivityTracking(options: ActivityTrackingOptions = {}) {
  // ... existing code ...

  useEffect(() => {
    console.log('🟢 ActivityTracking initialized', { enabled, sessionId });
  }, [enabled, sessionId]);

  useEffect(() => {
    if (sessionId) {
      console.log('✅ Session created:', sessionId);
    }
  }, [sessionId]);

  // ... rest of code
```

Refresh and check console - you should see these logs.

---

## Step 9: Check if User Profile Exists

```sql
-- Check if you have a user profile
SELECT id, email, role, is_active, company_id
FROM user_profiles
WHERE email = 'YOUR_EMAIL_HERE';
```

**If no profile exists:** The ActivityTrackingProvider might not be able to track you.

---

## Step 10: Check for Auth Issues

The API routes require authentication. Verify:

```sql
-- Check current auth session
SELECT auth.uid();
```

**If returns NULL:** You're not authenticated in the SQL context (this is OK)

But in the browser, check:

```javascript
// Check if authenticated in browser
const supabase = createClient();
supabase.auth.getUser().then(({ data, error }) => {
  console.log('Auth user:', data.user);
  console.log('Auth error:', error);
});
```

---

## Common Issues & Fixes

### Issue 1: "Function not found" errors
**Fix:** Re-run the entire migration SQL file

### Issue 2: "Permission denied" / RLS errors
**Fix:** The database functions use `SECURITY DEFINER` but RLS policies might still block. Try this:

```sql
-- Temporarily disable RLS for testing (re-enable after!)
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_heartbeats DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_events DISABLE ROW LEVEL SECURITY;

-- Test if it works now, then re-enable:
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;
```

### Issue 3: API routes returning 401
**Fix:** Check if you're logged in and session is valid

### Issue 4: Session not being created
**Fix:** Check if `ActivityTrackingProvider` is wrapping your pages in the layout

### Issue 5: No heartbeats being sent
**Fix:** Check if the heartbeat interval timer is running (add console.logs)

---

## Quick Test Script

Run this complete test in your browser console after logging in:

```javascript
async function testTracking() {
  console.log('🧪 Testing tracking system...');

  // 1. Test session creation
  console.log('\n1️⃣ Creating session...');
  const sessionRes = await fetch('/api/activity/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const sessionData = await sessionRes.json();
  console.log('Session:', sessionData);

  if (!sessionData.sessionId) {
    console.error('❌ Failed to create session!');
    return;
  }

  // 2. Test heartbeat
  console.log('\n2️⃣ Sending heartbeat...');
  const heartbeatRes = await fetch('/api/activity/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: sessionData.sessionId,
      pagePath: '/test',
      activityType: 'page_active',
      metadata: { test: true }
    })
  });
  const heartbeatData = await heartbeatRes.json();
  console.log('Heartbeat:', heartbeatData);

  // 3. Test event
  console.log('\n3️⃣ Tracking event...');
  const eventRes = await fetch('/api/activity/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: sessionData.sessionId,
      eventType: 'page_view',
      eventData: { test: true }
    })
  });
  const eventData = await eventRes.json();
  console.log('Event:', eventData);

  console.log('\n✅ All tests completed!');
}

testTracking();
```

---

## What to Send Me

After running these tests, send me:
1. Any console errors (screenshots or copy-paste)
2. Network tab showing failed API calls (status codes + responses)
3. Results from the SQL queries (Step 3-4)
4. Output from the Quick Test Script

This will help me identify exactly what's broken!
