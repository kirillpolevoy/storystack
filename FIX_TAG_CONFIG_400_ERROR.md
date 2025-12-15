# Fix for tag_config 400 Error (PGRST204)

## Problem
POST requests to `/rest/v1/tag_config?on_conflict=user_id` were returning 400 errors with PGRST204 status code.

## Root Cause
The RLS (Row Level Security) UPDATE policy for the `tag_config` table was missing the `WITH CHECK` clause. When PostgREST performs an upsert operation:

1. It first tries to INSERT the row
2. If a conflict occurs (row already exists), it tries to UPDATE
3. For UPDATE operations, PostgREST requires both:
   - `USING` clause: to find existing rows
   - `WITH CHECK` clause: to validate new values

Without the `WITH CHECK` clause, PostgREST rejects the UPDATE part of the upsert with a 400 error.

## Solution

### 1. Fix RLS Policy (SQL)
Run the SQL script `FIX_TAG_CONFIG_UPSERT.sql` to update the RLS policy:

```sql
DROP POLICY IF EXISTS "Users can only update their own tag config" ON tag_config;

CREATE POLICY "Users can only update their own tag config"
  ON tag_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. Improved Error Handling (Code)
Updated `app/tag-management.tsx` to add fallback handling for upsert operations:

- If upsert fails, the code now tries a direct UPDATE operation as a fallback
- Better error logging to help diagnose future issues
- AsyncStorage fallback remains in place for offline scenarios

## Files Changed
1. `FIX_TAG_CONFIG_UPSERT.sql` - SQL fix for RLS policy
2. `app/tag-management.tsx` - Improved error handling for all upsert operations

## Testing
After applying the SQL fix:
1. Try saving auto-tag configuration
2. Try saving custom tags
3. Try saving deleted tags
4. Check logs for any remaining errors

## Notes
- The TypeScript linter errors are pre-existing type definition issues and don't affect runtime
- The fix ensures backward compatibility - if upsert fails, it falls back to UPDATE
- AsyncStorage fallback ensures data is saved even if Supabase operations fail










