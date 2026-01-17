# Usage Tracking System - Security & Data Integrity Review

## 🔴 CRITICAL ISSUES

### 1. RLS Disabled - SECURITY RISK
**Issue:** Row-Level Security is currently disabled on tracking tables.
**Impact:** Any authenticated user can read/write ANY user's tracking data.
**Risk Level:** HIGH

**Current State:**
```sql
-- These tables have RLS disabled:
- user_activity_events
- daily_usage_stats
```

**Recommendation:** Re-enable RLS with proper policies (see fix-rls-policies.sql).

**Temporary Mitigation:** Access is limited to authenticated users only, and dashboards filter by user/company properly. But a malicious user could craft API calls to access other users' data.

---

### 2. Session Endpoint Has No Auth on DELETE
**Issue:** We removed authentication from DELETE /api/activity/session to fix logout issue.
**Impact:** Anyone with a session ID could end someone else's session.
**Risk Level:** MEDIUM

**Why we did this:** User is already logged out when trying to end session, so auth check fails.

**Mitigation:**
- Session IDs are UUIDs (hard to guess)
- Ending someone else's session doesn't leak data, just marks it inactive
- Session will auto-close after 5 minutes anyway

**Better Solution:** Add a signed token or HMAC to validate session ownership without requiring full auth.

---

### 3. Multiple Tabs/Windows
**Issue:** If user opens multiple tabs, each creates its own session.
**Impact:** Duplicate sessions, inflated session counts.
**Risk Level:** LOW

**Current Behavior:**
- Each tab checks sessionStorage for existing session
- If found within 1 hour, reuses it
- **BUT** each tab has separate sessionStorage in some browsers

**Mitigation:** Use localStorage instead of sessionStorage (shared across tabs).

---

## 🟡 MODERATE ISSUES

### 4. Heartbeat Failure = Data Loss
**Issue:** If heartbeat API fails (network error, server down), that time is lost forever.
**Impact:** Undercounted active time.
**Risk Level:** MEDIUM

**Current Behavior:**
- Error is logged to console
- No retry mechanism
- Next heartbeat in 30 seconds will try again

**Recommendation:**
- Add retry logic with exponential backoff
- Queue failed heartbeats in localStorage
- Flush queue when connection restored

---

### 5. Data Aggregation Failures
**Issue:** If `update_daily_usage_stats()` fails during heartbeat, stats won't update.
**Impact:** Dashboard shows stale/missing data until manually aggregated.
**Risk Level:** MEDIUM

**Current Behavior:**
```typescript
supabase.rpc('update_daily_usage_stats', ...)
  .then(({ error: statsError }) => {
    if (statsError) {
      console.warn('Failed to update daily stats:', statsError);
    }
  });
```

**The problem:**
- Runs in background (non-blocking)
- Error only logged, never retried
- User never knows aggregation failed

**Recommendation:**
- Set up a scheduled job (cron) to re-aggregate all stats daily
- Add monitoring/alerts for aggregation failures

---

### 6. Race Conditions in Aggregation
**Issue:** Multiple heartbeats could trigger `update_daily_usage_stats()` simultaneously for same user/date.
**Impact:** Duplicate calculations, wasted DB resources.
**Risk Level:** LOW

**Current Mitigation:**
- Database function uses UPSERT logic
- Should handle concurrent calls safely
- But inefficient

**Recommendation:** Add debouncing or locking mechanism.

---

## 🟢 MINOR ISSUES

### 7. beforeunload Unreliability
**Issue:** `beforeunload` event doesn't always fire (mobile, force quit, crash).
**Impact:** Some sessions never end, stay "Active" forever.
**Risk Level:** LOW

**Current Mitigation:**
- Auto-close function runs on dashboard load
- Closes sessions with no heartbeat for 5+ minutes
- Should catch most abandoned sessions

**Additional Recommendation:** Run auto-close as a scheduled job every 5 minutes.

---

### 8. Session Reuse Logic
**Issue:** Session reuse checks if session is < 1 hour old AND same user.
**Impact:** If user leaves tab open for 2+ hours, creates new session without closing old one.
**Risk Level:** LOW

**Current Code:**
```typescript
if (storedSessionId && storedSessionTime && storedUserId === user.id) {
  const sessionAge = Date.now() - parseInt(storedSessionTime);
  if (sessionAge < 60 * 60 * 1000) { // 1 hour
    setSessionId(storedSessionId);
    return storedSessionId;
  }
}
```

**Recommendation:** Before creating new session, explicitly end the old one.

---

### 9. No Heartbeat Deduplication
**Issue:** If user has multiple tabs open and they share sessionStorage, multiple heartbeats could be sent.
**Impact:** Overcounted active time (e.g., 2 tabs = 2x heartbeats = 2x time).
**Risk Level:** MEDIUM (if using localStorage instead of sessionStorage)

**Current Mitigation:** Each tab has separate sessionStorage, so separate sessions.

**If switching to localStorage:** Need to implement tab coordination (BroadcastChannel API).

---

### 10. Timezone Issues
**Issue:** Server uses UTC, client might be in different timezone.
**Impact:** Daily stats might split across wrong dates from user's perspective.
**Risk Level:** LOW

**Current Behavior:**
```typescript
p_date: new Date().toISOString().split('T')[0] // Always UTC date
```

**Example:**
- User active at 11:30 PM PST (January 17)
- Server sees 7:30 AM UTC (January 18)
- Stats recorded under January 18 instead of January 17

**Recommendation:** Accept this as expected behavior (all stats in UTC), or adjust to use user's timezone.

---

## 📊 DATA INTEGRITY CHECKS

### Missing Data Scenarios

**Scenario 1: User active but no heartbeats recorded**
- Possible causes: API errors, network issues, JavaScript errors
- Detection: Session exists but heartbeat count = 0
- Mitigation: Run this diagnostic query:
```sql
SELECT us.id, us.session_start, us.session_end,
       (SELECT COUNT(*) FROM activity_heartbeats WHERE session_id = us.id) as heartbeat_count
FROM user_sessions us
WHERE heartbeat_count = 0 AND session_end IS NOT NULL;
```

**Scenario 2: Heartbeats exist but daily stats = 0**
- Possible causes: Aggregation function error, RLS blocking insert
- Detection: Compare heartbeat count vs daily_usage_stats
- Mitigation: Manual aggregation script

**Scenario 3: Session never ended**
- Possible causes: Browser crash, force close, beforeunload failed
- Detection: `is_active = true` AND `last_heartbeat > 5 minutes ago`
- Mitigation: Auto-close function (already implemented)

---

## 🛡️ SECURITY RECOMMENDATIONS

### Immediate (High Priority)
1. **Re-enable RLS** with proper policies
2. **Add session validation** to DELETE endpoint (signed token)
3. **Add rate limiting** to prevent heartbeat spam

### Short Term (Medium Priority)
4. **Add request validation** - Validate sessionId format (UUID)
5. **Add CSRF protection** - Ensure requests come from your domain
6. **Audit logging** - Log who accesses whose data

### Long Term (Nice to Have)
7. **Encryption** - Encrypt PII in activity_heartbeats (IP addresses)
8. **Data retention policy** - Auto-delete heartbeats older than 90 days
9. **Anonymization** - For case studies, strip PII before export

---

## 🔧 RECOMMENDED FIXES

### Fix 1: Re-enable RLS (Critical)
Run the `fix-rls-policies.sql` script, but modify the service to use service role key for internal operations:

```typescript
// In heartbeat API, use service role for aggregation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Use admin client for aggregation (bypasses RLS)
await supabaseAdmin.rpc('update_daily_usage_stats', {...});
```

### Fix 2: Add Session Ownership Validation
Instead of removing auth entirely, validate session belongs to user:

```typescript
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { sessionId } = body;

  // Verify session exists and get owner (no auth required)
  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // End session
  await supabase.rpc('end_user_session', { p_session_id: sessionId });
  return NextResponse.json({ success: true });
}
```

### Fix 3: Switch to localStorage + Tab Coordination
Prevents duplicate sessions across tabs:

```typescript
// Check if session exists in localStorage (shared across tabs)
const storedSessionId = localStorage.getItem('activity_session_id');

// Use BroadcastChannel to coordinate heartbeats across tabs
const channel = new BroadcastChannel('activity_tracking');
channel.postMessage({ type: 'heartbeat', sessionId });
```

### Fix 4: Add Heartbeat Retry Queue
```typescript
// Store failed heartbeats in localStorage
const queueKey = 'failed_heartbeats';
const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');

// On heartbeat failure
queue.push({ sessionId, timestamp: Date.now(), ... });
localStorage.setItem(queueKey, JSON.stringify(queue));

// On heartbeat success, flush queue
if (queue.length > 0) {
  await flushHeartbeatQueue();
}
```

---

## ✅ WHAT'S WORKING WELL

1. **Session ending on logout** - Now works correctly
2. **Auto-close inactive sessions** - Handles abandoned sessions
3. **Audio playback detection** - Accurately tracks listening time
4. **Inactivity detection** - Prevents idle time from being counted
5. **Session ownership checks** - Prevents cross-user session reuse
6. **Heartbeat interval** - 30 seconds is a good balance
7. **Database functions** - Well-structured, use transactions
8. **Dashboard filtering** - Properly scoped to user/company

---

## 📋 TESTING CHECKLIST

Before deploying to production:

- [ ] Test logout with multiple tabs open
- [ ] Test browser force-close (kill process)
- [ ] Test network disconnection during activity
- [ ] Test switching between users rapidly
- [ ] Test with 10+ tabs open simultaneously
- [ ] Test incognito/private browsing mode
- [ ] Test mobile Safari (notoriously unreliable)
- [ ] Verify no PII leaks in browser console
- [ ] Verify RLS policies block unauthorized access
- [ ] Load test: 100 concurrent heartbeats

---

## 🎯 PRIORITY RECOMMENDATIONS

**Do Right Now:**
1. Re-enable RLS with service role key for aggregation
2. Add session validation to DELETE endpoint
3. Add monitoring/alerts for aggregation failures

**Do This Week:**
4. Implement heartbeat retry queue
5. Add scheduled job for auto-close sessions
6. Add scheduled job for daily aggregation (backup)

**Do Eventually:**
7. Switch to localStorage with tab coordination
8. Add encryption for IP addresses
9. Implement data retention policy

---

## 📞 SUPPORT & MONITORING

**Key Metrics to Monitor:**
- Aggregation failure rate
- Sessions without heartbeats
- Active sessions older than 1 hour
- Heartbeat API error rate

**Diagnostic Queries:**
See `full-diagnostic.sql` for comprehensive health checks.

**Emergency Procedures:**
If tracking breaks:
1. Check Supabase logs for RLS policy errors
2. Run manual aggregation for affected dates
3. Check API endpoint status codes
4. Verify database functions exist

---

## 🏁 CONCLUSION

**Overall Assessment:** System is functional but has security vulnerabilities due to disabled RLS.

**Data Loss Risk:** LOW-MEDIUM
- Minor data loss from failed heartbeats (acceptable)
- Major issue would be RLS allowing data tampering

**Security Risk:** MEDIUM
- Disabled RLS is the main concern
- Session endpoint has weak auth

**Recommendation:** Re-enable RLS as priority #1, everything else is acceptable for internal use.
