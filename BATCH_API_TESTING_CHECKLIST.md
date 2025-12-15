# Batch API Testing Checklist

## ✅ Pre-Testing Requirements

### 1. Database Migration (REQUIRED)
- [ ] Run `ADD_OPENAI_BATCH_ID_COLUMN.sql` in Supabase SQL Editor
- [ ] Verify column exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'openai_batch_id';`

### 2. Edge Function Deployment (REQUIRED)
- [ ] Deploy updated edge function: `supabase functions deploy auto_tag_asset`
- [ ] Verify function is deployed: `supabase functions list`
- [ ] Test GET endpoint manually: `curl "https://your-project.supabase.co/functions/v1/auto_tag_asset?batch_id=test"`

### 3. Environment Variables (REQUIRED)
- [ ] `OPENAI_API_KEY` is set in Supabase Edge Function secrets
- [ ] `EXPO_PUBLIC_EDGE_BASE_URL` is set in your app (for client-side polling)
- [ ] Verify: `supabase secrets list` shows `OPENAI_API_KEY`

### 4. Client-Side Polling (OPTIONAL but Recommended)
- [ ] Add polling initialization to `app/_layout.tsx` (see below)
- [ ] Or manually call `initializeBatchPolling()` when needed

### 5. TypeScript Types (OPTIONAL)
- [ ] Add `openai_batch_id?: string` to `Asset` type in `types.ts` (if not already there)

---

## 🧪 Testing Steps

### Test 1: Import 20+ Images
1. Import 20+ images in the app
2. Check console logs for: `🚀 Using OpenAI Batch API for X images`
3. Check database: `SELECT openai_batch_id, auto_tag_status FROM assets WHERE openai_batch_id IS NOT NULL LIMIT 5;`
4. Verify `openai_batch_id` is set and `auto_tag_status = 'pending'`

### Test 2: Batch Creation
1. Check edge function logs: `supabase functions logs auto_tag_asset`
2. Look for: `✅ Batch job created successfully: batch_xxx`
3. Verify batch exists in OpenAI: Check OpenAI dashboard or API

### Test 3: Polling (Client-Side)
1. If polling is integrated, check console for: `🚀 Starting batch polling (every 2 seconds)...`
2. Wait for batch to complete (can take minutes to hours)
3. Check console for: `✅ Batch xxx processed successfully`
4. Verify assets updated: `SELECT tags, auto_tag_status FROM assets WHERE openai_batch_id = 'batch_xxx';`

### Test 4: Manual Polling (GET Endpoint)
1. Get a batch_id from database
2. Call: `GET https://your-project.supabase.co/functions/v1/auto_tag_asset?batch_id=batch_xxx`
3. Should return: `{"success": true, "message": "Batch results processed successfully"}`

### Test 5: Import < 20 Images (Should Use Regular API)
1. Import 5-15 images
2. Check console logs for: `🎯 CALLING getSuggestedTagsBatch` (NOT Batch API)
3. Verify tags appear immediately (synchronous)

---

## 🐛 Common Issues

### Issue: "openai_batch_id column does not exist"
**Fix:** Run `ADD_OPENAI_BATCH_ID_COLUMN.sql` migration

### Issue: "Batch API failed, falling back to regular API"
**Check:**
- OpenAI API key is valid
- Batch API is enabled for your OpenAI account
- Check edge function logs for detailed error

### Issue: "Polling not working"
**Check:**
- `EXPO_PUBLIC_EDGE_BASE_URL` is set correctly
- Edge function URL is accessible
- Check browser/app console for errors

### Issue: "Batch never completes"
**Check:**
- Batch status in OpenAI dashboard
- Edge function logs for errors
- Try manual polling via GET endpoint

---

## 📊 Monitoring

### Check Pending Batches
```sql
SELECT 
  openai_batch_id,
  COUNT(*) as asset_count,
  MIN(created_at) as oldest_asset,
  MAX(created_at) as newest_asset
FROM assets
WHERE openai_batch_id IS NOT NULL
  AND auto_tag_status = 'pending'
GROUP BY openai_batch_id;
```

### Check Batch Status in OpenAI
```bash
curl https://api.openai.com/v1/batches/batch_xxx \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Check Edge Function Logs
```bash
supabase functions logs auto_tag_asset --tail
```

---

## ✅ Ready to Test?

**Before testing, ensure:**
1. ✅ Database migration run
2. ✅ Edge function deployed
3. ✅ OpenAI API key configured
4. ⚠️ Client-side polling integrated (optional)

**Then test with:**
- Import 20+ images → Should use Batch API
- Import < 20 images → Should use regular API
- Wait for batch completion → Tags should appear
