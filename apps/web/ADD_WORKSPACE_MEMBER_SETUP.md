# Add Workspace Member Edge Function Setup

## Deployment

The `add-workspace-member` edge function needs to be deployed to Supabase.

### Option 1: Deploy via Supabase CLI

```bash
# Make sure you're in the project root
cd /Users/kpolevoy/storystack

# Deploy the function
supabase functions deploy add-workspace-member
```

### Option 2: Deploy via Supabase Dashboard

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it `add-workspace-member`
4. Copy the contents of `supabase/functions/add-workspace-member/index.ts`
5. Paste into the editor
6. Deploy

## Environment Variables

The function requires these environment variables (set automatically by Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for Admin API access)

These are automatically available in Supabase Edge Functions, so no manual setup needed.

## Testing

Once deployed, the function will be available at:
```
https://[your-project-ref].supabase.co/functions/v1/add-workspace-member
```

The web app will automatically call this function when adding members.

## How It Works

1. User (admin/owner) enters an email address in workspace settings
2. Frontend calls the edge function with workspace_id, email, and role
3. Edge function:
   - Validates the requester has admin+ role
   - Uses Admin API to find user by email in auth.users
   - Adds user to workspace_members table
   - Returns success/error

## Limitations

- User must already have a StoryStack account (be in auth.users)
- For inviting new users, you'd need to implement an invite system (send email, create pending invite, etc.)

