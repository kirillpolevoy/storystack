# How to Update the App Icon on iPhone

## Steps to Update the App Icon

### 1. Prepare Your Icon Image
- Create a **1024x1024 pixel** PNG image
- The image should be square
- Use a transparent background if desired
- Save it as `icon.png`

### 2. Replace the Icon File
Replace the existing icon file:
```bash
# Replace ./assets/icon.png with your new icon
# Make sure it's exactly 1024x1024 pixels
```

### 3. Rebuild the App
After replacing the icon, you need to rebuild the app:

**For Development Build:**
```bash
# Clear cache and rebuild
npx expo prebuild --clean
npx expo run:ios
```

**For Production Build (EAS):**
```bash
# Build with EAS
eas build --platform ios --profile production
```

### 4. Install the New Build
- The new icon will appear after installing the rebuilt app
- You may need to delete the old app from your device first

## Icon Requirements

- **Size**: 1024x1024 pixels (required by Apple)
- **Format**: PNG
- **No transparency**: iOS icons should not have transparency (use a solid background)
- **No rounded corners**: iOS automatically adds rounded corners
- **No text**: Avoid including text in the icon (iOS may add effects)

## Current Configuration

- Icon file: `./assets/icon.png`
- iOS build number: 8 (updated to trigger icon refresh)
- The icon is configured in `app.json` under `ios.icon`

## Notes

- Expo automatically generates all required icon sizes from the 1024x1024 source
- The icon appears on the home screen after rebuilding and installing
- For TestFlight/App Store, the icon must be included in the build submitted to Apple














