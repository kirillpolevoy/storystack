# Apply Email Function Migration

## Step 1: Apply the Database Function

Run this SQL in Supabase SQL Editor to fix email display:

```sql
CREATE OR REPLACE FUNCTION get_workspace_members_with_emails(workspace_id_param UUID)
RETURNS TABLE (
  workspace_id UUID,
  user_id UUID,
  role TEXT,
  created_at TIMESTAMPTZ,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wm.workspace_id,
    wm.user_id,
    wm.role,
    wm.created_at,
    COALESCE(u.email, 'Unknown') as email
  FROM workspace_members wm
  LEFT JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = workspace_id_param
    AND is_workspace_member(workspace_id_param)
  ORDER BY wm.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_workspace_members_with_emails(UUID) TO authenticated;
```

## Step 2: Redeploy Edge Function

After applying the migration, redeploy the edge function:

```bash
supabase functions deploy add-workspace-member
```

## Step 3: Email Sending

The edge function now logs invitation details but doesn't actually send emails yet. To enable email sending:

1. **Option A: Use Resend** (Recommended)
   - Sign up at https://resend.com
   - Get API key
   - Add to Supabase secrets: `supabase secrets set RESEND_API_KEY=your_key`
   - Uncomment the Resend code in the edge function

2. **Option B: Use SendGrid**
   - Similar setup with SendGrid API

3. **Option C: Use Supabase Database Webhooks**
   - Set up a webhook that triggers on invitation creation
   - Send email from a separate service

For now, invitations are created but emails aren't sent. The invitation will work when the user signs up with the invited email.

