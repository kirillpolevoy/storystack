# Supabase Auth "Failed to Fetch" Troubleshooting

## Common Causes

### 1. Environment Variables Not Embedded (Most Likely)

`NEXT_PUBLIC_*` variables are embedded at **build time**, not runtime. If you added env vars after building, they won't be available.

**Solution:**
1. Make sure env vars are set in Vercel
2. **Redeploy** (this rebuilds with the env vars)
3. Clear browser cache and try again

### 2. CORS Configuration

Supabase might be blocking requests from your Vercel domain.

**Check Supabase Settings:**
1. Go to Supabase Dashboard → Your Project
2. Settings → API
3. Under "CORS", make sure your Vercel domain is allowed
4. Or add `*` temporarily for testing (not recommended for production)

**Vercel domains to allow:**
- `https://web-eight-jet-39.vercel.app`
- `https://web-[your-project].vercel.app`
- `https://[your-custom-domain].com` (if you have one)

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

