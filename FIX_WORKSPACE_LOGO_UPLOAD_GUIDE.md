# Fix Workspace Logo Upload RLS Policy

The storage policy for `workspace_logos` needs to be updated. Since storage policies require special permissions, you need to update them via the Supabase Dashboard.

## Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Storage** → **Policies**
3. Select the `workspace_logos` bucket
4. Find the policy named `workspace_logos_insert_owner`
5. Click **Edit** or **Delete** (if editing doesn't work, delete and recreate)

### For INSERT Policy (`workspace_logos_insert_owner`):

**Policy Name:** `workspace_logos_insert_owner`
**Allowed Operation:** INSERT
**Policy Definition:**

```sql
(
  bucket_id = 'workspace_logos' AND
  (storage.foldername(name))[1] = 'workspaces' AND
  (storage.foldername(name))[3] = 'logo' AND
  EXISTS (
    SELECT 1 
    FROM workspace_members wm
    WHERE wm.workspace_id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
)
```

### For UPDATE Policy (`workspace_logos_update_owner`):

**Policy Name:** `workspace_logos_update_owner`
**Allowed Operation:** UPDATE

**Using Expression:**
```sql
(
  bucket_id = 'workspace_logos' AND
  (storage.foldername(name))[1] = 'workspaces' AND
  (storage.foldername(name))[3] = 'logo' AND
  EXISTS (
    SELECT 1 
    FROM workspace_members wm
    WHERE wm.workspace_id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
)
```

**With Check Expression:**
```sql
(
  bucket_id = 'workspace_logos' AND
  (storage.foldername(name))[1] = 'workspaces' AND
  (storage.foldername(name))[3] = 'logo' AND
  EXISTS (
    SELECT 1 
    FROM workspace_members wm
    WHERE wm.workspace_id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
)
```

## Option 2: Via SQL Editor with Service Role (Advanced)

If you have access to the service role key, you can run the SQL using a Supabase client with service role credentials:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key, not anon key
)

// Then run the SQL from FIX_WORKSPACE_LOGO_UPLOAD.sql
```

## What Changed?

The original policy was using `has_workspace_role()` function which doesn't work reliably in storage policies. The fix uses a direct check:

**Before:**
```sql
has_workspace_role(w.id, 'owner')
```

**After:**
```sql
EXISTS (
  SELECT 1 
  FROM workspace_members wm
  WHERE wm.workspace_id::text = (storage.foldername(name))[2]
    AND wm.user_id = auth.uid()
    AND wm.role = 'owner'
)
```

This directly checks if the user is an owner member of the workspace without relying on the function.

## Verification

After updating the policies, test by:
1. Going to Workspace Settings
2. Clicking "Upload New Logo"
3. Selecting an image file
4. The upload should succeed without RLS errors

