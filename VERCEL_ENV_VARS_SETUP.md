# Vercel Environment Variables Setup

## Required Environment Variables

You need to add **2 environment variables** to your Vercel project:

### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Description**: Your Supabase project URL
- **Format**: `https://[your-project-ref].supabase.co`
- **Example**: `https://abcdefghijklmnop.supabase.co`
- **Where to find**: 
  - Go to your Supabase project dashboard
  - Settings → API
  - Copy the "Project URL"

### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Description**: Your Supabase anonymous/public API key
- **Format**: A long string starting with `eyJ...`
- **Where to find**:
  - Go to your Supabase project dashboard
  - Settings → API
  - Copy the "anon public" key (NOT the service_role key)

## How to Add in Vercel

1. Go to your Vercel project dashboard
2. Click on the **"web"** project (not "storystack")
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Add each variable:
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Your Supabase project URL
   - **Environment**: Check ✅ **Production**, ✅ **Preview**, ✅ **Development**
   - Click **Save**
6. Repeat for the second variable:
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Your Supabase anon key
   - **Environment**: Check ✅ **Production**, ✅ **Preview**, ✅ **Development**
   - Click **Save**

## ⚠️ IMPORTANT: After Adding Variables

**You MUST redeploy** for the variables to take effect:

1. Go to **Deployments** tab
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger auto-deploy

## Verification

After redeploying, check the function logs:
1. Go to **Deployments** → Latest deployment
2. Click **Functions** tab
3. Look for logs - you should NOT see:
   - `[Middleware] Missing Supabase environment variables`
   - `Missing Supabase environment variables`

If you see those errors, the variables aren't set correctly or you need to redeploy.

## Security Notes

- ✅ `NEXT_PUBLIC_*` variables are safe to expose (they're public)
- ✅ The anon key is designed to be public (it has RLS protection)
- ❌ Never use the `service_role` key in frontend code
- ❌ Never commit these values to git (use `.env.local` locally)




