# Debugging TestFlight Crash

## Changes Made

1. ✅ Added Error Boundary to `app/_layout.tsx` - will catch and display errors instead of crashing
2. ✅ Added try-catch blocks around async initialization in `app/index.tsx`
3. ✅ Improved error handling for campaign and tag loading

## Next Steps

### 1. Rebuild with Error Handling

The error boundary will now catch crashes and show an error message instead of crashing silently. Rebuild:

```bash
eas build --platform ios --profile production
```

### 2. Check Crash Logs

**On Device:**
- Settings → Privacy & Security → Analytics & Improvements → Analytics Data
- Look for entries with your app name
- Tap to view crash details

**Via Xcode:**
- Connect device to Mac
- Xcode → Window → Devices and Simulators
- Select device → View Device Logs
- Filter by your app name

**Via App Store Connect:**
- App Store Connect → Your App → TestFlight → Crashes
- View crash reports and stack traces

### 3. Common Causes

**Environment Variables:**
- Verify environment variables are set: `eas env:list production`
- Check that `EXPO_PUBLIC_*` variables are accessible at runtime

**Native Modules:**
- `expo-media-library` requires permissions
- `expo-image-picker` requires permissions
- Ensure all native modules are properly linked

**Async Initialization:**
- `getDefaultCampaignId()` might fail if Supabase is unavailable
- `getAllAvailableTags()` might fail if database is unreachable
- Both now have fallbacks

### 4. Test Locally First

Before rebuilding, test the production build locally:

```bash
# Build for device (not simulator)
eas build --platform ios --profile production --local

# Or test in simulator with production-like settings
npx expo run:ios --configuration Release
```

### 5. Add More Logging

If crash persists, add console logs to identify where it fails:

```typescript
// In app/index.tsx, add logs:
console.log('[LibraryScreen] Component mounting');
console.log('[LibraryScreen] Supabase available:', !!supabase);
console.log('[LibraryScreen] Environment vars:', {
  hasUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
  hasKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
});
```

## What the Error Boundary Does

- Catches JavaScript errors in the component tree
- Displays a user-friendly error message
- Logs errors to console (visible in device logs)
- Prevents app from crashing completely

## If Still Crashing

1. Check if it's a native crash (not caught by error boundary)
2. Verify all native modules are compatible with Expo SDK 54
3. Check for memory issues or resource limits
4. Review App Store Connect crash reports for native stack traces

