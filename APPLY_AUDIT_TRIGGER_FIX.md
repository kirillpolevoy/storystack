# Apply Audit Trigger Fix

## Problem
When updating workspace name, error occurs:
```
record "old" has no field "role"
Error code: 42703
```

## Solution
The audit trigger was checking `OLD.role` for all tables, but `workspaces` table doesn't have a `role` column.

## Apply Fix

### Option 1: Run SQL Directly in Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `FIX_AUDIT_TRIGGER.sql`
3. Run the SQL

### Option 2: Use Supabase CLI (if linked)

```bash
supabase db push
```

### Option 3: Apply via Migration (if local Supabase is running)

```bash
supabase migration up
```

## What This Fixes

- ✅ Workspace name updates will work
- ✅ Workspace logo updates will work  
- ✅ Audit logging will work correctly for workspaces
- ✅ Role changes in workspace_members still logged correctly

## Test After Fix

1. Try updating workspace name
2. Should work without errors
3. Check audit_log table to verify entries are created

