# StoryStack

A React Native mobile application for organizing, tagging, and building photo stories. StoryStack helps you manage your photo library with intelligent tagging and create curated story sequences.

## Features

- 📸 **Photo Library Management**: Import and organize photos from your device
- 🏷️ **Smart Tagging**: Tag photos with custom or predefined tags
- 🤖 **AI Auto-Tagging**: Automatically tag photos using AI vision (configurable per tag)
  - Batch processing with intelligent retry logic
  - Partial success handling - individual image failures don't block others
  - Automatic image compression and optimization for AI processing
- 📚 **Tag Management**: Create, edit, rename, and delete tags with usage tracking
- 🎬 **Story Builder**: Select and arrange photos to create story sequences
- 💾 **Export Stories**: Export story sequences to your device's photo library as albums
- 🔍 **Filter & Search**: 
  - Filter photos by tags to quickly find what you need
  - Filter photos without tags
  - Multi-select mode for batch operations
- 🔄 **Batch Retagging**: Select multiple photos and rerun autotagging in bulk
- 🚫 **Duplicate Detection**: Automatically detect and handle duplicate photos during import
- 📱 **Campaign Organization**: Organize photos into campaigns

## Tech Stack

- **Framework**: React Native with Expo (SDK 54)
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL database + Storage + Edge Functions)
- **AI**: OpenAI GPT-4 Vision API (via Supabase Edge Functions)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: React Hooks
- **Build & Deploy**: EAS Build & Submit

## Current Version

**v1.2.0** (Build 13)

Latest improvements:
- Enhanced batch autotagging with better error handling
- Multi-select retagging functionality
- Filter photos without tags
- Improved image compression for AI processing
- Partial success handling for batch operations

## Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Supabase account and project
- Apple Developer account (for iOS builds)
- Google Play Developer account (for Android builds)

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/kirillpolevoy/storystack.git
   cd storystack
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_EDGE_BASE_URL=your_edge_function_url (optional, for AI tagging)
   ```

   For production builds, set these as EAS secrets:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value your_value --type string
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your_value --type string
   eas secret:create --scope project --name EXPO_PUBLIC_EDGE_BASE_URL --value your_value --type string
   ```

4. **Set up Supabase**
   
   Your Supabase project needs the following tables:
   - `campaigns` - Stores campaign information
   - `assets` - Stores photo metadata and tags
   - `tag_config` - Stores tag configuration (custom tags, deleted tags, auto-tag settings)
   
   Storage bucket:
   - `assets` - Stores uploaded photos (includes A1 originals and A2 AI-optimized versions)
   
   Edge Functions:
   - `auto_tag_asset` - Handles AI tagging requests with batch processing

5. **Run the development server**
   ```bash
   npm start
   ```

## Development

### Running on iOS Simulator
```bash
npm run ios
```

### Running on Android Emulator
```bash
npm run android
```

### Running on Web
```bash
npm run web
```

## Building for Production

### iOS (TestFlight/App Store)

1. **Configure EAS** (if not already done)
   ```bash
   eas login
   eas build:configure
   ```

2. **Update build number** (required for each submission)
   
   Update in three places:
   - `app.json`: `ios.buildNumber`
   - `ios/StoryStack/Info.plist`: `CFBundleVersion`
   - `ios/StoryStack.xcodeproj/project.pbxproj`: `CURRENT_PROJECT_VERSION`

3. **Build for iOS**
   ```bash
   eas build --platform ios --profile production
   ```

4. **Submit to TestFlight**
   ```bash
   eas submit --platform ios --profile production --latest
   ```

### Android (Google Play)

1. **Build for Android**
   ```bash
   eas build --platform android --profile production
   ```

2. **Submit to Google Play**
   ```bash
   eas submit --platform android --profile production --latest
   ```

## Project Structure

```
storystack/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout with error boundary
│   ├── index.tsx          # Main library screen
│   ├── campaign/[id].tsx  # Campaign detail screen
│   ├── story-builder.tsx  # Story building interface
│   └── tag-management.tsx # Tag management screen
├── components/            # Reusable React components
│   ├── PhotoGrid.tsx
│   ├── StoryPanel.tsx
│   ├── TagFilterBar.tsx
│   ├── TagModal.tsx
│   ├── ImportLoadingOverlay.tsx
│   └── LibraryHeader.tsx
├── lib/                   # Library code
│   └── supabase.ts        # Supabase client configuration
├── utils/                 # Utility functions
│   ├── exportStory.ts     # Story export functionality
│   ├── getDefaultCampaign.ts
│   ├── getAllAvailableTags.ts
│   ├── autoTagQueue.ts    # Batch autotagging queue management
│   ├── compressImage.ts   # Image compression utilities
│   └── duplicateDetection.ts
├── supabase/
│   └── functions/
│       └── auto_tag_asset/ # Edge Function for AI tagging
├── types.ts              # TypeScript type definitions
├── app.json              # Expo configuration
├── eas.json              # EAS Build configuration
└── package.json          # Dependencies
```

## Key Features Explained

### Tag Management
- **Custom Tags**: Create your own tags beyond the default StoryStack tags
- **Auto-Tagging**: Enable AI auto-tagging for specific tags
- **Tag Usage**: See how many photos use each tag
- **Tag Deletion**: Delete tags and optionally remove them from all photos
- **Batch Retagging**: Select multiple photos in multi-select mode and rerun autotagging for all selected photos

### Story Builder
- Select multiple photos from your library
- Arrange them in a custom order
- Name your story
- Export as an album to your device's photo library

### Campaigns
- Organize photos into campaigns
- Each campaign has its own photo collection
- Filter and manage photos within campaigns

### AI Auto-Tagging
- **Intelligent Batching**: Processes multiple images efficiently with rate limiting
- **Partial Success**: If one image fails, others continue processing
- **Image Optimization**: Automatically creates optimized A2 versions for AI processing
- **Error Recovery**: Automatic retry logic for transient failures
- **Size Management**: Handles large images with compression and Base64 conversion when needed

## Troubleshooting

### Build Number Issues
If you get errors about build number being too low:
1. Check all three locations (app.json, Info.plist, project.pbxproj)
2. Ensure the build number is higher than the last submitted build
3. Rebuild after updating the build number

### Supabase Connection Issues
- Verify environment variables are set correctly
- Check Supabase project is active
- Ensure database tables and storage buckets are created

### App Crashes on Launch
- Check device logs for error messages
- Verify all environment variables are set
- Ensure Supabase tables exist and are accessible

### Autotagging Issues
- Verify OpenAI API key is set in Supabase Edge Function secrets
- Check Edge Function logs in Supabase dashboard
- Ensure `tag_config` table has proper auto-tag settings configured
- Large images are automatically compressed, but check Edge Function logs if issues persist

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ using React Native and Expo

