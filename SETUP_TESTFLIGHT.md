# TestFlight Setup Guide

## Completed Steps ✅

1. ✅ Created `eas.json` with build profiles
2. ✅ Updated `app.json` with iOS bundleIdentifier (`com.storystack.app`), buildNumber, and privacy descriptions
3. ✅ Updated `.gitignore` to exclude sensitive files
4. ✅ Installed EAS CLI globally

## Next Steps (Require Your Action)

### Step 1: Login to Expo

Run this command in your terminal:
```bash
eas login
```

You'll be prompted to:
- Enter your Expo email/username (or sign up at https://expo.dev if you don't have an account)
- Enter your password
- Complete any 2FA if enabled

### Step 2: Link Project to Expo Account

After logging in, run:
```bash
eas build:configure
```

This will link your project to your Expo account.

### Step 3: Update eas.json with Your Apple ID

Edit `eas.json` and replace `"your-apple-id@example.com"` with your actual Apple ID email in the submit section.

### Step 4: Set Up Environment Variables as EAS Secrets

You need to set these environment variables as EAS secrets for production builds. Replace the values with your actual credentials:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value your_supabase_url
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your_supabase_anon_key
eas secret:create --scope project --name EXPO_PUBLIC_EDGE_BASE_URL --value your_edge_function_url
```

**To find your values:**
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL (found in Supabase dashboard → Settings → API)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key (same location)
- `EXPO_PUBLIC_EDGE_BASE_URL`: Your Supabase Edge Functions base URL (usually `https://your-project.supabase.co/functions/v1`)

### Step 5: Build iOS App for TestFlight

Run the production build:
```bash
eas build --platform ios --profile production
```

**During the build process:**
- Select "Let EAS handle credentials" when prompted (recommended)
- Provide your Apple ID credentials when asked
- Wait for build to complete (15-30 minutes)
- You can monitor progress at https://expo.dev/accounts/[your-username]/projects/storystack/builds

### Step 6: Submit to TestFlight

Once the build completes, submit it to TestFlight:

**Option A - Automatic (Recommended):**
```bash
eas submit --platform ios --latest
```

**Option B - Manual:**
1. Download the `.ipa` file from the EAS dashboard
2. Use the Transporter app (from Mac App Store) or Xcode to upload
3. Go to App Store Connect → TestFlight to process

### Step 7: Configure TestFlight

1. Go to https://appstoreconnect.apple.com → TestFlight
2. Select your app (it will be created automatically if this is the first build)
3. Add testers:
   - **Internal Testing**: Add up to 100 team members
   - **External Testing**: Add external testers (requires App Store review for first external build)
4. Add build notes/description
5. Enable the build for testing
6. Invite testers via email or share a public link

## Important Notes

- **Bundle Identifier**: Currently set to `com.storystack.app` in `app.json`. Make sure this matches what you want in App Store Connect, or update it before building.
- **Apple Developer Account**: You need a paid Apple Developer account ($99/year) to submit to TestFlight
- **Build Number**: Increment the `buildNumber` in `app.json` for each new build
- **Version**: Update the `version` in `app.json` when releasing major updates

## Troubleshooting

- **Build fails**: Check logs at https://expo.dev/accounts/[your-username]/projects/storystack/builds
- **Credentials issue**: Run `eas credentials` to manage certificates
- **Environment variables not working**: Verify secrets with `eas secret:list`
- **TestFlight upload fails**: Ensure bundle identifier matches App Store Connect

## Verify Setup

After completing the steps above, verify everything is configured:

```bash
# Check login status
eas whoami

# List configured secrets
eas secret:list

# View project info
eas project:info
```


