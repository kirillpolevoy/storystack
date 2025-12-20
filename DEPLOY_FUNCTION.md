# Deploy Add Workspace Member Function

To deploy the edge function, you need your Supabase project reference.

## Option 1: Deploy via Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** in the left sidebar
4. Click **"Create a new function"**
5. Name it: `add-workspace-member`
6. Copy the entire contents of `supabase/functions/add-workspace-member/index.ts`
7. Paste into the code editor
8. Click **"Deploy"**

## Option 2: Deploy via CLI

If you know your project reference (found in your Supabase URL: `https://[project-ref].supabase.co`):

```bash
supabase functions deploy add-workspace-member --project-ref YOUR_PROJECT_REF
```

You'll be prompted for your database password.

## Option 3: Link Project First

```bash
# Link your project (you'll need your project ref and database password)
supabase link --project-ref YOUR_PROJECT_REF

# Then deploy
supabase functions deploy add-workspace-member
```

## Verify Deployment

After deploying, the function will be available at:
```
https://[your-project-ref].supabase.co/functions/v1/add-workspace-member
```

The web app will automatically use this endpoint when adding workspace members.

