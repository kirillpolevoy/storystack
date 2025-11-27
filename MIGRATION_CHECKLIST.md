# Migration Verification Checklist

## Quick Verification Steps

1. **Run `VERIFY_MIGRATION.sql`** in Supabase SQL Editor
2. Check all items show ✅ PASS in the summary section
3. Review each section for any ❌ FAIL or ⚠️ CHECK items

## Expected Results

### ✅ All Should Pass:

1. **user_id columns exist and NOT NULL**
   - All 3 tables (campaigns, assets, tag_config) should have user_id column
   - All should be NOT NULL

2. **tag_config uses user_id as primary key**
   - tag_config should have user_id as primary key
   - Should NOT have 'id' column anymore

3. **tag_config does NOT have id column**
   - The old 'id' column should be removed

4. **RLS enabled on all tables**
   - All 3 tables should have RLS enabled

5. **RLS policies exist (12 total)**
   - 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
   - 3 tables × 4 operations = 12 policies minimum

6. **No NULL user_id values**
   - All rows should have user_id populated

## If Something Fails

### If user_id is still nullable:
```sql
ALTER TABLE campaigns ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE assets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tag_config ALTER COLUMN user_id SET NOT NULL;
```

### If tag_config still has 'id' column:
```sql
ALTER TABLE tag_config DROP CONSTRAINT IF EXISTS tag_config_pkey;
ALTER TABLE tag_config DROP COLUMN IF EXISTS id;
ALTER TABLE tag_config ADD PRIMARY KEY (user_id);
```

### If RLS is not enabled:
```sql
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_config ENABLE ROW LEVEL SECURITY;
```

### If policies are missing:
See `COMPLETE_MIGRATION.sql` Step 5 for all policy creation statements.

## Code Verification

All code has been updated to use `user_id`:
- ✅ `getDefaultCampaign.ts` - uses user_id
- ✅ `getAllAvailableTags.ts` - uses user_id  
- ✅ `app/index.tsx` - asset inserts include user_id
- ✅ `app/campaign/[id].tsx` - asset inserts include user_id
- ✅ `app/tag-management.tsx` - all functions use user_id
- ✅ `supabase/functions/auto_tag_asset/index.ts` - uses user_id
- ✅ Storage paths include user_id

## Final Test

After verification, test the app:
1. Sign in as a user
2. Create/import assets
3. Manage tags
4. Verify you only see your own data
5. Sign in as a different user
6. Verify you see different data (complete isolation)


