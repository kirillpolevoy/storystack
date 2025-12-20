# Resend Domain Verification Setup

## Current Issue

Resend's test domain (`onboarding@resend.dev`) only allows sending emails to your verified email address (`kpolevoy@gmail.com`). To send emails to any recipient, you need to verify your domain.

## Option 1: Verify Your Domain (Recommended for Production)

1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter your domain (e.g., `storystackstudios.com`)
4. Add the DNS records Resend provides to your domain's DNS settings:
   - SPF record
   - DKIM records (usually 2-3 records)
   - DMARC record (optional but recommended)
5. Wait for verification (usually a few minutes)
6. Once verified, update the edge function to use your domain:
   ```typescript
   from: 'StoryStack <invites@storystackstudios.com>',
   ```

## Option 2: Use Test Mode (For Development)

For now, emails will only be sent to your verified email (`kpolevoy@gmail.com`). This is fine for testing.

To test with other emails:
- Add them to your Resend account as verified emails, OR
- Verify your domain (Option 1)

## Option 3: Set Verified Email Secret

You can set a different verified email if needed:

```bash
supabase secrets set RESEND_VERIFIED_EMAIL=your-email@example.com
```

## Current Behavior

- ✅ Invitations are created successfully
- ✅ Users are added to workspaces
- ⚠️ Emails only send to verified email address (`kpolevoy@gmail.com`)
- ✅ When users sign up, they're automatically added (invitation system works)

## Next Steps

1. **For testing**: Use your verified email (`kpolevoy@gmail.com`) as the recipient
2. **For production**: Verify your domain in Resend and update the `from` address

The invitation system works - users will be automatically added when they sign up, even if they don't receive the email immediately.

