# Fix Supabase CORS Error

## The Problem
Your app at `https://web-eight-jet-39.vercel.app` is being blocked by CORS when trying to authenticate.

**Error:** `Access to fetch at 'https://myoqdmtcgqejqknxgdjz.functions.supabase.co/auth/v1/token' from origin 'https://web-eight-jet-39.vercel.app' has been blocked by CORS policy`

## Important: CORS vs Redirect URLs

- **Redirect URLs** = Where users go AFTER OAuth login (for OAuth flows)
- **CORS** = Which domains can make API requests (needed for all auth)

You need to configure **CORS**, not just redirect URLs.

## How to Find CORS Settings in Supabase

### Option 1: Settings → API (Most Common)
1. Go to Supabase Dashboard → Your Project
2. **Settings** (gear icon in left sidebar)
3. Click **"API"** (under PROJECT SETTINGS)
4. Scroll down to find **"CORS"** section
5. Add your domains there

### Option 2: Settings → Authentication → URL Configuration
1. Go to Supabase Dashboard → Your Project
2. **Settings** → **Authentication**
3. Look for **"URL Configuration"** or **"Site URL"**
4. There might be a **"CORS Origins"** field here

### Option 3: Check if CORS is Auto-Enabled
Some newer Supabase projects auto-allow all origins. If you don't see CORS settings:
- Your project might be using the new API key system
- Check if there's a "Restrict API access" toggle that needs to be disabled

## What to Add

In the CORS settings, add these domains (one per line):

```
https://web-eight-jet-39.vercel.app
https://web-1zy5w5uxm-kirills-projects-39b715a7.vercel.app
https://*.vercel.app
```

Or temporarily add `*` to allow all origins (for testing only).

## Alternative: Check Supabase Project URL Format

The error shows requests going to:
`https://myoqdmtcgqejqknxgdjz.functions.supabase.co`

But typically Supabase uses:
`https://myoqdmtcgqejqknxgdjz.supabase.co`

**Check your environment variable:**
- In Vercel, verify `NEXT_PUBLIC_SUPABASE_URL` is set to:
  - ✅ `https://myoqdmtcgqejqknxgdjz.supabase.co` (correct)
  - ❌ `https://myoqdmtcgqejqknxgdjz.functions.supabase.co` (might be wrong)

## If You Still Can't Find CORS Settings

1. **Check Supabase Dashboard Version:**
   - Newer projects might have CORS auto-enabled
   - Look for "API Access" or "Restrict API" settings

2. **Try the Supabase CLI:**
   ```bash
   supabase projects api-keys list
   ```

3. **Contact Supabase Support:**
   - They can help locate CORS settings for your specific project type

## After Adding CORS

1. **Save** the settings
2. **Wait 30-60 seconds** for changes to propagate
3. **Clear browser cache** (or use incognito mode)
4. **Try logging in again**

## Verify It's Fixed

After updating CORS, check the browser console:
- ✅ No CORS errors = Fixed!
- ❌ Still seeing CORS errors = Check if you added the correct domain

