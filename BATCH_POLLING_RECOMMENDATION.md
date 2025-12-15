# Batch API Polling Recommendation

## ⚡ Current Configuration: **2-Second Polling (Client-Side)**

**Client-side polling:** Every 2 seconds  
**Server-side polling:** Every 1 minute (backup, pg_cron minimum)

## 🎯 Recommended Approach: **Hybrid (Server + Client)**

### **Primary: Server-Side Polling (pg_cron)**
✅ **Most Reliable** - Works even when app is closed  
✅ **No Battery Drain** - Runs server-side  
✅ **Automatic** - No user interaction needed  
✅ **Scalable** - Handles all users' batches  

**Implementation:** `CREATE_BATCH_POLLING_CRON.sql`

### **Fallback: Client-Side Polling**
✅ **Immediate Feedback** - Updates UI as soon as batch completes  
✅ **Better UX** - Users see progress while app is open  
✅ **Backup** - Works if server-side polling fails  

**Implementation:** `utils/pollBatchStatus.ts`

---

## 📋 Implementation Steps

### Step 1: Set Up Server-Side Polling (Recommended)

1. **Run the SQL migration:**
   ```sql
   -- Execute CREATE_BATCH_POLLING_CRON.sql in Supabase SQL Editor
   ```

2. **Configure Edge Function URL:**
   ```sql
   -- Get your edge function URL:
   -- supabase functions list
   -- Or from Supabase Dashboard > Edge Functions
   
   -- Set it in database:
   ALTER DATABASE postgres SET app.edge_function_url = 'https://your-project.supabase.co/functions/v1';
   ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key';
   ```

3. **Verify cron job is scheduled:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'poll-openai-batches';
   ```

### Step 2: Add Client-Side Polling (Optional but Recommended)

1. **Add to your app initialization** (e.g., `app/_layout.tsx`):
   ```typescript
   import { initializeBatchPolling } from '@/utils/pollBatchStatus';
   
   // In your root component:
   useEffect(() => {
     initializeBatchPolling();
     return () => {
       stopBatchPolling();
     };
   }, []);
   ```

2. **Add batch ID to polling when created:**
   ```typescript
   import { addBatchToPoll } from '@/utils/pollBatchStatus';
   
   // After creating batch:
   if (result.batchId) {
     addBatchToPoll(result.batchId);
   }
   ```

3. **Listen for batch completion events:**
   ```typescript
   useEffect(() => {
     const handler = (e: CustomEvent) => {
       // Refresh assets to show new tags
       loadAssets();
     };
     
     window.addEventListener('batchCompleted', handler);
     return () => window.removeEventListener('batchCompleted', handler);
   }, []);
   ```

---

## 🔧 Alternative Options

### Option A: **Server-Side Only** (Simplest)
- ✅ Just run the SQL migration
- ✅ No client code needed
- ❌ Slower feedback (up to 10 min delay)
- ❌ No real-time updates

### Option B: **Client-Side Only** (Not Recommended)
- ✅ Immediate feedback
- ❌ Only works when app is open
- ❌ Battery drain
- ❌ Doesn't work if user closes app

### Option C: **Webhook** (Not Available)
- ❌ OpenAI doesn't provide webhooks for Batch API
- ❌ Would require external service

---

## ⚙️ Configuration

### Polling Intervals

**Server-Side (pg_cron):**
- Default: Every 1 minute (minimum interval for pg_cron)
- ⚠️ **Note:** pg_cron cannot poll every 2 seconds (1 minute is minimum)
- For 2-second polling, use client-side only

**Client-Side:**
- Default: Every 2 seconds ⚡
- Configured in `pollBatchStatus.ts`: `POLL_INTERVAL_MS = 2000`
- ⚠️ **Note:** 2-second polling uses more battery/resources, but provides near-instant feedback

### When to Poll

**Server-Side:**
- Checks batches older than 5 minutes (gives OpenAI time to process)
- Processes up to 10 batches per run

**Client-Side:**
- Starts when app loads
- Stops after 1 hour (120 attempts)
- Stops when no pending batches

---

## 🎨 UX Recommendations

1. **Show Batch Status:**
   - Display "Processing batch..." indicator for assets with `openai_batch_id`
   - Show batch ID for debugging

2. **Progress Indicator:**
   - "Tagging 20 images... (Batch API - 50% savings)"
   - Update when batch completes

3. **Error Handling:**
   - Show error if batch fails
   - Allow manual retry

---

## 📊 Monitoring

**Check pending batches:**
```sql
SELECT 
  openai_batch_id,
  COUNT(*) as asset_count,
  MIN(created_at) as oldest_asset
FROM assets
WHERE openai_batch_id IS NOT NULL
  AND auto_tag_status = 'pending'
GROUP BY openai_batch_id;
```

**Check cron job logs:**
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'poll-openai-batches')
ORDER BY start_time DESC
LIMIT 10;
```

---

## ✅ My Recommendation

**Use both server-side AND client-side polling:**

1. **Server-side (pg_cron)** - Primary, handles everything automatically
2. **Client-side** - Fallback + better UX when app is open

This gives you:
- ✅ Reliability (server-side always runs)
- ✅ Fast feedback (client-side when app is open)
- ✅ No battery drain (server-side does heavy lifting)
- ✅ Best user experience




