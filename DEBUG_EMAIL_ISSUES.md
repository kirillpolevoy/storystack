# Debug Email Sending Issues

## Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions → `add-workspace-member` → Logs
2. Look for these log messages:
   - `Email sending check:` - Shows if API key is detected
   - `RESEND_API_KEY not set` - Means secret isn't configured
   - `Resend API error:` - Shows API errors
   - `Invitation email sent successfully:` - Confirms email was sent

## Verify Resend API Key Format

Resend API keys should start with `re_` (e.g., `re_123abc...`)

If your key doesn't start with `re_`, it's not a valid Resend key.

## Common Issues

### 1. API Key Not Set Correctly
- Check: `supabase secrets list | grep RESEND`
- Should show: `RESEND_API_KEY | re_...`
- If missing or wrong format, set it: `supabase secrets set RESEND_API_KEY=re_your_key`

### 2. Domain Not Verified
- Resend requires domain verification for production
- Check Resend Dashboard → Domains
- For testing, use Resend's test domain: `onboarding@resend.dev`
- Update the `from` field in the edge function to use test domain

### 3. Email Going to Spam
- Check spam folder
- Verify domain SPF/DKIM records in Resend
- Use a verified domain for better deliverability

### 4. API Errors
- Check Resend Dashboard → Emails for delivery status
- Check edge function logs for error messages
- Common errors:
  - `403 Forbidden` - Invalid API key
  - `422 Unprocessable` - Invalid email format or domain not verified
  - `429 Too Many Requests` - Rate limit exceeded

## Test Email Sending

Try adding a member again and check:
1. Edge function logs (should show email sending attempt)
2. Resend Dashboard → Emails (should show sent email)
3. Email inbox (check spam too)

## Quick Fix: Use Test Domain

If domain isn't verified, update the `from` email in the edge function to:
```typescript
from: 'StoryStack <onboarding@resend.dev>',  // Test domain - no verification needed
```

Then redeploy: `supabase functions deploy add-workspace-member`

