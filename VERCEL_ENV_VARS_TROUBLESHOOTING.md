# Vercel Environment Variables Troubleshooting

## Issue: Environment Variables Not Available at Runtime

The error logs show that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not available to your serverless functions at runtime.

## How to Fix

### Step 1: Verify Environment Variables Are Set

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Verify both variables are listed:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 2: Check Environment Scope

**CRITICAL:** Make sure the variables are set for **Production** environment:

- Click on each variable
- Verify it's enabled for:
  - ✅ **Production**
  - ✅ **Preview** (optional but recommended)
  - ✅ **Development** (optional)

### Step 3: Redeploy After Adding Variables

**IMPORTANT:** After adding or modifying environment variables, you **must** redeploy:

1. Go to **Deployments** tab
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger a new deployment

### Step 4: Verify Variables Are Available

After redeploying, check the function logs:
1. Go to **Deployments** → Click latest deployment
2. Go to **Functions** tab
3. Check logs for any "[Middleware] Missing Supabase environment variables" messages

If you still see the error, the variables might not be set correctly.

## Common Issues

### Issue 1: Variables Set for Wrong Environment
- **Solution:** Make sure variables are enabled for **Production**

### Issue 2: Variables Added But Not Redeployed
- **Solution:** Redeploy after adding variables

### Issue 3: Typo in Variable Names
- **Solution:** Double-check the exact names:
  - `NEXT_PUBLIC_SUPABASE_URL` (not `SUPABASE_URL`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not `SUPABASE_ANON_KEY`)

### Issue 4: Variables Set at Organization Level Instead of Project Level
- **Solution:** Make sure variables are set at the **Project** level, not Organization level

## Quick Test

To verify variables are available, you can temporarily add this to your code:

```typescript
console.log('Env check:', {
  hasUrl: !!process.env.    NEXT_PUBLIC_SUPABASE_URL,
  hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20)
})
```

Check the function logs to see if these values are logged.




