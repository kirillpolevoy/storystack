# Complete Environment Variables Guide for Vercel Deployment

## Required for Basic App Functionality (Login/Auth)

These **must** be set in Vercel for the app to work:

### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Format:** `https://[project-ref].supabase.co`
- **Example:** `https://myoqdmtcgqejqknxgdjz.supabase.co`
- **Important:** 
  - ✅ Use `.supabase.co` (NOT `.functions.supabase.co`)
  - ✅ No trailing slash
  - ✅ Must start with `https://`
- **Where to find:** Supabase Dashboard → Settings → API → Project URL

### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Format:** Starts with `eyJ...` (JWT token)
- **Where to find:** Supabase Dashboard → Settings → API → anon public key
- **Important:** Use the **anon public** key, NOT the service_role key

## Required for Auto-Tagging Feature (Optional)

The auto-tagging feature uses OpenAI, but this is **separate** from Vercel env vars:

### `OPENAI_API_KEY` (Supabase Edge Function Secret)
- **NOT set in Vercel** - this goes in Supabase Edge Function secrets
- **Where to set:** Supabase Dashboard → Edge Functions → Secrets
- **Command:** `supabase secrets set OPENAI_API_KEY=your-key-here`
- **Note:** This is only needed if you want the auto-tagging feature to work

## How to Set in Vercel

1. Go to Vercel Dashboard → Your Project (`web`)
2. **Settings** → **Environment Variables**
3. Add each variable:
   - **Key:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** `https://myoqdmtcgqejqknxgdjz.supabase.co`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**
   
   Repeat for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Redeploy** after adding variables (they're embedded at build time)

## Verify Your Supabase URL Format

The CORS error shows requests going to:
```
https://myoqdmtcgqejqknxgdjz.functions.supabase.co
```

But it should be:
```
https://myoqdmtcgqejqknxgdjz.supabase.co
```

**Check your Vercel env var:**
- Go to Vercel → Settings → Environment Variables
- Verify `NEXT_PUBLIC_SUPABASE_URL` matches the correct format
- If it has `.functions.` in it, that's wrong - remove it

## Summary

**For login to work:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` (in Vercel)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (in Vercel)
- ✅ CORS configured in Supabase (if available)

**For auto-tagging to work:**
- ✅ `OPENAI_API_KEY` (in Supabase Edge Function secrets, NOT Vercel)

## After Setting Variables

1. **Redeploy** your Vercel project
2. **Wait for build to complete**
3. **Clear browser cache** or use incognito mode
4. **Try logging in again**

