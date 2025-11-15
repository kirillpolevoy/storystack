# Build Instructions for TestFlight

## Current Status ✅

- ✅ EAS CLI installed and logged in
- ✅ Project initialized and linked to Expo
- ✅ Environment variables configured (production)
- ✅ Git repository initialized
- ✅ Configuration files ready

## Next Step: Build iOS App

The build process requires interactive input for Apple Developer credentials. Run this command in your terminal:

```bash
eas build --platform ios --profile production
```

### During the build process, you'll be prompted for:

1. **Encryption compliance**: Answer "No" (your app uses standard HTTPS encryption which is exempt)
2. **Apple Developer credentials**: 
   - Choose "Let EAS handle credentials" (recommended) - EAS will manage certificates automatically
   - Or provide your Apple ID and app-specific password if you prefer manual management

### Build Process

- The build will take **15-30 minutes**
- You can monitor progress at: https://expo.dev/accounts/kpolevoy/projects/storystack/builds
- You'll receive an email when the build completes

### After Build Completes

Once the build finishes successfully, submit it to TestFlight:

```bash
eas submit --platform ios --latest
```

This will automatically:
- Upload the build to App Store Connect
- Process it for TestFlight

### Then Configure TestFlight

1. Go to https://appstoreconnect.apple.com → TestFlight
2. Your app will appear automatically (first build creates the app listing)
3. Add testers:
   - **Internal Testing**: Add team members (up to 100)
   - **External Testing**: Add external testers (requires App Store review for first external build)
4. Add build notes/description
5. Enable the build for testing
6. Invite testers via email or share public link

## Troubleshooting

- **Build fails**: Check logs at the EAS dashboard URL above
- **Credentials issue**: Run `eas credentials` to manage certificates manually
- **Environment variables**: Verify with `eas env:list production`

## Important Notes

- **Bundle Identifier**: Currently `com.storystack.app` - make sure this matches what you want in App Store Connect
- **Build Number**: Increment `buildNumber` in `app.json` for each new build
- **Version**: Update `version` in `app.json` for major releases

