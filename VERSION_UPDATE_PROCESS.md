# Version Update Process

## Overview
When preparing for production deployment, all version numbers must be updated consistently across all configuration files.

## Files That Contain Version Numbers

1. **app.json**
   - `expo.version` - App version (semantic versioning, e.g., "1.1.0")
   - `expo.ios.buildNumber` - iOS build number (string, e.g., "8")
   - `expo.android.versionCode` - Android version code (number, e.g., 8)

2. **package.json**
   - `version` - Should match `app.json` `expo.version`

## Update Process

When you say "ready to go to prod", the following will happen automatically:

1. **Build numbers increment** (iOS buildNumber and Android versionCode)
   - Both will be set to the same number
   - If not specified, it will increment from the highest current build number

2. **App version syncs** (package.json matches app.json)
   - `package.json.version` will be synced to match `app.json.expo.version`
   - App version only increments when explicitly requested (major releases)

## Manual Update (if needed)

You can also manually run the update script:
```bash
# Auto-increment build numbers, sync package.json version
node scripts/update-version.js

# Specify a specific build number
node scripts/update-version.js 9

# Increment build numbers AND app version (for major releases)
node scripts/update-version.js --increment-app-version
```

## Current Versions

- App version: **1.1.0**
- iOS build number: **8**
- Android version code: **8**
- Package version: **1.1.0**

