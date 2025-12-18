# Supabase Auth "Failed to Fetch" Troubleshooting

## Common Causes

### 1. Environment Variables Not Embedded (Most Likely)

`NEXT_PUBLIC_*` variables are embedded at **build time**, not runtime. If you added env vars after building, they won't be available.

**Solution:**
1. Make sure env vars are set in Vercel
2. **Redeploy** (this rebuilds with the env vars)
3. Clear browser cache and try again

### 2. CORS Configuration (YOUR CURRENT ISSUE)

Supabase is blocking requests from your Vercel domain. The error shows:
```
Access to fetch at 'https://[project].functions.supabase.co/auth/v1/token' 
from origin 'https://web-1zy5w5uxm-kirills-projects-39b715a7.vercel.app' 
has been blocked by CORS policy
```

**Fix CORS in Supabase:**
1. Go to Supabase Dashboard → Your Project (`myoqdmtcgqejqknxgdjz`)
2. Settings → API
3. Scroll down to **"CORS"** section
4. Add your Vercel domains (one per line):
   ```
   https://web-1zy5w5uxm-kirills-projects-39b715a7.vercel.app
   https://web-eight-jet-39.vercel.app
   https://*.vercel.app
   ```
   Or add `*` temporarily for testing (allows all origins - not recommended for production)
5. Click **Save**
6. Wait a few seconds for changes to propagate
7. Try logging in again

**Important:** Vercel uses preview URLs with random hashes. To allow all preview deployments, use:
- `https://*.vercel.app` (allows all Vercel preview URLs)
- Or add your production domain specifically

### 3. Verify Environment Variables Are Set

After redeploying, check the browser console:
- Open DevTools → Console
- Look for: `[createClient] Creating Supabase client with URL: https://...`
- If you see "Missing Supabase environment variables", the env vars aren't set

### 4. Check Network Tab

1. Open DevTools → Network tab
2. Try logging in
3. Look for failed requests to `*.supabase.co`
4. Check the error details:
   - **CORS error**: Add your domain to Supabase CORS settings
   - **404**: Check if Supabase URL is correct
   - **Network error**: Check internet connection

## Quick Fixes

### Fix 1: Rebuild with Env Vars
```bash
# Make sure env vars are set in Vercel, then:
# Go to Vercel → Deployments → Redeploy
```

### Fix 2: Check Supabase URL Format
Make sure your `NEXT_PUBLIC_SUPABASE_URL` is:
- ✅ `https://[project-ref].supabase.co` (correct)
- ❌ `https://[project-ref].supabase.co/` (trailing slash - wrong)
- ❌ Missing `https://` (wrong)

### Fix 3: Verify Anon Key
- Make sure you're using the **anon public** key, not the service_role key
- The anon key should start with `eyJ...`
- Find it: Supabase Dashboard → Settings → API → anon public

## Debug Steps

1. **Check browser console** for error messages
2. **Check Network tab** for failed requests
3. **Verify env vars** are set in Vercel (Settings → Environment Variables)
4. **Redeploy** after adding env vars
5. **Check Supabase logs** (Dashboard → Logs → API) for incoming requests

