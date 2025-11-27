# OAuth Implementation Guide: Google & Apple Sign-In

## Overview
This guide covers adding Google and Apple OAuth authentication to your StoryStack app, including linking existing email/password accounts to OAuth providers.

## What's Involved

### 1. Supabase Configuration
- Enable OAuth providers in Supabase Dashboard
- Configure redirect URLs
- Get OAuth credentials from Google and Apple

### 2. React Native Setup
- Install OAuth libraries (`expo-auth-session` or `@react-native-google-signin/google-signin` + `expo-apple-authentication`)
- Configure deep linking for OAuth callbacks
- Update auth context with OAuth methods

### 3. UI Updates
- Add "Sign in with Google" and "Sign in with Apple" buttons
- Add account linking UI in profile screen
- Handle OAuth flows

### 4. Account Linking
- Link OAuth providers to existing accounts
- Handle conflicts (email already exists)
- Show linked accounts in profile

## Step-by-Step Implementation

### Step 1: Supabase Dashboard Configuration

#### Google OAuth:
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Google"
3. Get credentials from Google Cloud Console:
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase

#### Apple OAuth:
1. Enable "Apple" in Supabase Dashboard
2. Get credentials from Apple Developer:
   - Create Service ID
   - Configure Sign in with Apple
   - Add redirect URI: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - Copy Service ID, Team ID, Key ID, and Private Key to Supabase

### Step 2: Install Required Packages

```bash
npm install expo-auth-session expo-crypto expo-apple-authentication
```

For Google (choose one approach):
- Option A: Use Supabase's built-in OAuth (recommended)
- Option B: Use `@react-native-google-signin/google-signin` for native Google Sign-In

### Step 3: Update AuthContext

Add OAuth methods:
- `signInWithGoogle()`
- `signInWithApple()`
- `linkGoogleAccount()`
- `linkAppleAccount()`
- `unlinkProvider()`
- `getLinkedAccounts()`

### Step 4: Update Login/Signup Screens

Add OAuth buttons with proper styling matching your premium aesthetic.

### Step 5: Update Profile Screen

Add section to:
- Show linked accounts
- Link additional providers
- Unlink providers

### Step 6: Deep Linking

Ensure OAuth callbacks work with your existing deep linking setup (`storystack://auth/callback`).

## Account Linking Flow

1. User signs in with email/password
2. User goes to Profile → "Link Google Account"
3. OAuth flow starts
4. If email matches → Link automatically
5. If email doesn't match → Ask user to confirm
6. If account already exists → Show error, offer to sign in with that provider instead

## Edge Cases to Handle

- Email mismatch between OAuth and existing account
- OAuth account already exists with different email
- User tries to link same provider twice
- User unlinks last provider (must have at least one)

## Security Considerations

- Verify email ownership before linking
- Require password confirmation for linking
- Show clear UI for linked accounts
- Handle token refresh for OAuth sessions


