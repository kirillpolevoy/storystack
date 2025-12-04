# TestFlight Beta Setup Guide

## Current Configuration ✅

- **App Name**: StoryStack
- **Version**: 1.1.4
- **Build Number**: 9
- **Bundle ID**: com.storystackstudio.app
- **EAS Project ID**: 5e7f1fb6-c53f-4894-a313-857133a38ba9

## Prerequisites

1. ✅ **Apple Developer Account** ($99/year) - Required for TestFlight
2. ✅ **Expo Account** - You have one (owner: storystack)
3. ✅ **EAS CLI** - Install if needed: `npm install -g eas-cli`

## Step-by-Step Setup

### Step 1: Login to Expo

```bash
eas login
```

Enter your Expo credentials. Verify login:
```bash
eas whoami
```

### Step 2: Verify Project Configuration

Check your project is linked:
```bash
eas project:info
```

### Step 3: Set Up Environment Variables (EAS Secrets)

Set your Supabase credentials as EAS secrets (required for production builds):

```bash
# Set Supabase URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL"

# Set Supabase Anon Key
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_SUPABASE_ANON_KEY"

# Verify secrets are set
eas secret:list
```

**To find your Supabase values:**
- Go to Supabase Dashboard → Settings → API
- Copy the Project URL and anon/public key

### Step 4: Configure Apple Credentials

EAS can automatically manage your Apple credentials. When you build, choose:
- **"Let EAS handle credentials"** (recommended)

You'll need:
- Apple ID email
- App-Specific Password (if 2FA enabled)
- Apple Developer Team ID (found in Apple Developer portal)

### Step 5: Build for TestFlight

Build the iOS app for TestFlight:

```bash
eas build --platform ios --profile production
```

**What happens:**
1. EAS will prompt for Apple credentials (if not auto-managed)
2. Build will start in the cloud (15-30 minutes)
3. Monitor progress: https://expo.dev/accounts/storystack/projects/storystack/builds

**Build options:**
- Choose "production" profile (configured in eas.json)
- Select "Let EAS handle credentials" when prompted
- Wait for build to complete

### Step 6: Submit to TestFlight

Once build completes, submit automatically:

```bash
eas submit --platform ios --latest
```

**Or manually:**
1. Download `.ipa` from EAS dashboard
2. Use Transporter app or Xcode to upload
3. Go to App Store Connect → TestFlight

### Step 7: Configure TestFlight in App Store Connect

1. **Go to App Store Connect**: https://appstoreconnect.apple.com
2. **Navigate to TestFlight** tab
3. **Select your app** (created automatically on first submission)
4. **Add Test Information**:
   - What to Test (required for external testing)
   - Build notes
   - Screenshots (optional but recommended)

### Step 8: Add Testers

**Internal Testing (Up to 100 testers):**
1. Go to TestFlight → Internal Testing
2. Click "+" to add internal testers
3. Add team members by email
4. Select build and enable testing

**External Testing (Unlimited testers):**
1. Go to TestFlight → External Testing
2. Create a new group (e.g., "Beta Testers")
3. Add external testers by email
4. Submit for review (first external build requires App Store review)
5. Once approved, enable the build

### Step 9: Invite Testers

**Via Email:**
- TestFlight will send invitation emails automatically
- Testers need to install TestFlight app first

**Via Public Link:**
- Enable public link in TestFlight settings
- Share the link with testers

## Important Notes

### Version & Build Numbers
- **Version** (`app.json` → `version`): Update for major releases (e.g., 1.1.4 → 1.2.0)
- **Build Number** (`app.json` → `ios.buildNumber`): Increment for each new build (9 → 10 → 11...)
- TestFlight requires each build to have a unique build number

### App Store Connect Setup
- **App Name**: Must be unique in App Store
- **Bundle ID**: com.storystackstudio.app (must match exactly)
- **Privacy Policy**: Required for external testing
- **App Description**: Required for App Store submission

### Common Issues

**Build Fails:**
- Check build logs: https://expo.dev/accounts/storystack/projects/storystack/builds
- Verify environment variables: `eas secret:list`
- Check Apple Developer account status

**Credentials Error:**
- Run `eas credentials` to manage certificates
- Ensure Apple Developer account is active
- Verify Team ID is correct

**TestFlight Upload Fails:**
- Ensure bundle ID matches App Store Connect
- Check build number is unique
- Verify app is created in App Store Connect

## Quick Commands Reference

```bash
# Login
eas login

# Check login status
eas whoami

# View project info
eas project:info

# List secrets
eas secret:list

# Create secret
eas secret:create --scope project --name KEY_NAME --value "value"

# Build for TestFlight
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest

# View builds
# Visit: https://expo.dev/accounts/storystack/projects/storystack/builds

# Manage credentials
eas credentials
```

## Next Steps After TestFlight

1. **Gather Feedback**: Use TestFlight feedback or your own system
2. **Fix Issues**: Address bugs and feedback
3. **Iterate**: Build new versions with incremented build numbers
4. **Prepare for App Store**: Once beta is stable, prepare for App Store submission

## Checklist Before Building

- [ ] Apple Developer account active ($99/year)
- [ ] Expo account logged in (`eas login`)
- [ ] Environment variables set (`eas secret:list`)
- [ ] Version number correct (1.1.4)
- [ ] Build number correct (9)
- [ ] Bundle ID correct (com.storystackstudio.app)
- [ ] App icon updated (✅ Done - premium gold S icon)
- [ ] Privacy descriptions in app.json (✅ Done)
- [ ] Ready to build!

## Support

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **TestFlight Guide**: https://developer.apple.com/testflight/
- **EAS Support**: https://expo.dev/support

