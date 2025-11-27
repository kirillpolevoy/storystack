# OAuth Setup Checklist: Google & Apple Sign-In

## Prerequisites Checklist

### Supabase Configuration
- [ ] Enable Google OAuth in Supabase Dashboard
- [ ] Enable Apple OAuth in Supabase Dashboard
- [ ] Configure redirect URLs in Supabase
- [ ] Get Google OAuth credentials (Client ID, Client Secret)
- [ ] Get Apple OAuth credentials (Service ID, Team ID, Key ID, Private Key)

### Google Cloud Console Setup
- [ ] Create OAuth 2.0 Client ID
- [ ] Add authorized redirect URI: `https://[your-project-ref].supabase.co/auth/v1/callback`
- [ ] Copy Client ID and Client Secret

### Apple Developer Setup
- [ ] Create App ID with Sign in with Apple capability
- [ ] Create Service ID
- [ ] Configure Sign in with Apple
- [ ] Create Private Key for Sign in with Apple
- [ ] Add redirect URI: `https://[your-project-ref].supabase.co/auth/v1/callback`

### React Native Setup
- [ ] Install `expo-auth-session` and `expo-crypto`
- [ ] Install `expo-apple-authentication` (iOS only)
- [ ] Configure deep linking (already done - `storystack://`)
- [ ] Update `app.json` with OAuth URL schemes

## Implementation Steps

1. **Install packages**
2. **Update AuthContext** - Add OAuth methods
3. **Update Login/Signup screens** - Add OAuth buttons
4. **Update Profile screen** - Add account linking UI
5. **Test OAuth flows**
6. **Test account linking**

## Estimated Time
- Supabase configuration: 30-60 minutes
- Google/Apple developer setup: 1-2 hours
- Code implementation: 2-3 hours
- Testing: 1 hour
- **Total: 4-6 hours**


