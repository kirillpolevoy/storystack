# Setup Resend Email for Workspace Invitations

## Step 1: Create Resend Account

1. Go to https://resend.com
2. Sign up for a free account (100 emails/day free tier)
3. Verify your domain or use Resend's test domain

## Step 2: Get API Key

1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Name it "StoryStack Invitations"
4. Copy the API key (starts with `re_`)

## Step 3: Add API Key to Supabase

### Option A: Using Supabase CLI (Recommended)

```bash
supabase secrets set RESEND_API_KEY=re_your_api_key_here
```

### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add a new secret:
   - Name: `RESEND_API_KEY`
   - Value: Your Resend API key (starts with `re_`)

## Step 4: Set SITE_URL (Optional)

If you want custom invite links, set your site URL:

```bash
supabase secrets set SITE_URL=https://yourdomain.com
```

Or in dashboard: Settings → Edge Functions → Secrets → Add `SITE_URL`

## Step 5: Verify Domain (For Production)

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `storystackstudios.com`)
3. Add the DNS records Resend provides
4. Wait for verification
5. Update the `from` email in the edge function to use your domain:
   - Change: `'StoryStack <invites@storystackstudios.com>'`
   - To: `'StoryStack <invites@yourdomain.com>'`

## Step 6: Test

1. Try adding a member with a non-existent email
2. Check your email inbox (or Resend dashboard → Emails)
3. You should receive an invitation email

## Troubleshooting

- **No email received**: Check Resend dashboard → Emails for delivery status
- **API errors**: Check edge function logs in Supabase dashboard
- **Domain verification**: Make sure DNS records are correct if using custom domain

## Email Template

The invitation email includes:
- Workspace name
- Inviter's name
- Role (admin/editor/viewer)
- Accept invitation button
- Expiration notice (30 days)

