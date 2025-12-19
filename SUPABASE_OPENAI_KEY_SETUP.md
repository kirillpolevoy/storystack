# Set OpenAI API Key in Supabase Edge Functions

## Why This is Needed

Your `auto_tag_asset` edge function needs the OpenAI API key to generate tags for images. This is set in **Supabase Edge Function secrets**, NOT in Vercel environment variables.

## Method 1: Using Supabase Dashboard (Easiest)

1. Go to **Supabase Dashboard** → Your Project (`myoqdmtcgqejqknxgdjz`)
2. Click **Edge Functions** in the left sidebar
3. Click on **"auto_tag_asset"** function
4. Go to **Settings** tab (or look for **Secrets** section)
5. Add secret:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (starts with `sk-...`)
6. Click **Save**

## Method 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref myoqdmtcgqejqknxgdjz

# Set the secret
supabase secrets set OPENAI_API_KEY=sk-your-actual-key-here
```

## Method 3: Using Supabase Dashboard → Project Settings

1. Go to **Supabase Dashboard** → Your Project
2. **Settings** (gear icon) → **Edge Functions**
3. Look for **"Secrets"** or **"Environment Variables"** section
4. Add:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key
5. Click **Save**

## Verify It's Set

After setting the secret, verify it's working:

1. **Check Edge Function logs:**
   - Go to Edge Functions → `auto_tag_asset` → Logs
   - Look for errors about missing `OPENAI_API_KEY`

2. **Test the function:**
   - Upload an image in your app
   - Check logs to see if auto-tagging works

## Important Notes

- ✅ This is **separate** from Vercel environment variables
- ✅ The key is stored securely in Supabase (not exposed to client)
- ✅ Only the edge function can access it
- ✅ Changes take effect immediately (no redeploy needed)

## Get Your OpenAI API Key

If you don't have one:
1. Go to https://platform.openai.com/api-keys
2. Sign in or create account
3. Click **"Create new secret key"**
4. Copy the key (starts with `sk-...`)
5. **Important:** Save it somewhere safe - you can't view it again!

## Troubleshooting

**If auto-tagging still doesn't work:**
1. Check Edge Function logs for errors
2. Verify the key is correct (no extra spaces)
3. Make sure your OpenAI account has credits/quota
4. Check that the function is deployed: `supabase functions list`

