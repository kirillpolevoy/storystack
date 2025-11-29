# Production Deployment Checklist

## Pre-Deployment

### ✅ Build Numbers Updated
- iOS build number: **9**
- Android version code: **9**
- App version: **1.1.0**

### ✅ Key Features Ready
- [x] Onboarding flow for new users
- [x] Stories feature (create, view, manage)
- [x] Tag management with AI auto-tagging
- [x] Account deletion functionality
- [x] Menu drawer navigation
- [x] Floating Action Button (context-aware)
- [x] Delete user Edge Function deployed

### ✅ Database Migrations
- [x] Stories tables created (`CREATE_STORIES_TABLES.sql`)
- [x] Delete user Edge Function deployed (`supabase/functions/delete-user`)

## Deployment Steps

### 1. Build iOS App
```bash
eas build --platform ios --profile production
```

### 2. Build Android App
```bash
eas build --platform android --profile production
```

### 3. Submit to App Store (iOS)
```bash
eas submit --platform ios
```

### 4. Submit to Google Play (Android)
```bash
eas submit --platform android
```

## Environment Variables

Ensure these are set in EAS:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Edge Functions

The following Edge Functions are deployed:
- ✅ `auto_tag_asset` - AI auto-tagging
- ✅ `delete-user` - Account deletion

## Post-Deployment Verification

1. Test onboarding flow for new users
2. Verify account deletion works end-to-end
3. Test story creation and management
4. Verify tag management and AI auto-tagging
5. Test menu navigation across all screens

## Notes

- TypeScript linting errors are non-blocking (runtime null checks are in place)
- All critical features have been tested and are ready for production

