# How to Check Email Sending Logs

## Step 1: Check Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/myoqdmtcgqejqknxgdjz/functions
2. Click on `add-workspace-member`
3. Click on "Logs" tab
4. Try adding a member, then refresh the logs

Look for these log messages:
- `[Email] Starting email send process:` - Shows if API key is detected
- `[Email] RESEND_API_KEY not set` - API key missing
- `[Email] RESEND_API_KEY format invalid` - API key wrong format
- `[Email] Attempting to send email via Resend API...` - Email send started
- `[Email] Resend API response status:` - HTTP status code
- `[Email] ✅ Invitation email sent successfully:` - Email sent!
- `[Email] ❌ Exception sending invitation email:` - Error occurred

## Step 2: Verify API Key Format

Run this command:
```bash
supabase secrets list | grep RESEND
```

The key should:
- Start with `re_` (e.g., `re_123abc...`)
- Be about 50+ characters long

If it doesn't start with `re_`, it's not a valid Resend key.

## Step 3: Check Resend Dashboard

1. Go to https://resend.com/emails
2. You should see sent emails with delivery status
3. If no emails appear, the API call isn't reaching Resend

## Step 4: Test API Key Manually

You can test if your API key works by running:

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "your-email@example.com",
    "subject": "Test Email",
    "html": "<p>Test</p>"
  }'
```

Replace `YOUR_RESEND_API_KEY` with your actual key.

## Common Issues

1. **API Key not set**: Run `supabase secrets set RESEND_API_KEY=re_your_key`
2. **Wrong API key format**: Get a new key from https://resend.com/api-keys
3. **Domain not verified**: Using `onboarding@resend.dev` should work without verification
4. **Rate limiting**: Check Resend dashboard for rate limit status

