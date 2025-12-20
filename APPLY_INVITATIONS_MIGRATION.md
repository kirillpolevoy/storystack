# Apply Workspace Invitations Migration

## Quick Apply via Supabase Dashboard

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `supabase/migrations/20251219134925_create_workspace_invitations.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

## What This Migration Does

- Creates `workspace_invitations` table for pending invitations
- Sets up RLS policies so admins can manage invitations
- Creates function `process_workspace_invitations_for_user()` to auto-add users when they sign up
- Grants execute permissions to authenticated users

## Verify It Worked

After running the migration, verify it worked by running:

```sql
-- Check if table exists
SELECT * FROM workspace_invitations LIMIT 1;

-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'process_workspace_invitations_for_user';
```

Both queries should return results (even if empty for the table).

## Next Steps

After applying the migration:
1. The edge function `add-workspace-member` will automatically create invitations for non-existent users
2. When users sign up, they'll be automatically added to workspaces they were invited to
3. You can now add members by email even if they don't have accounts yet!

