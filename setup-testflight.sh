#!/bin/bash

# TestFlight Setup Script
# This script automates what it can and provides guidance for manual steps

set -e

echo "🚀 StoryStack TestFlight Setup"
echo "================================"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g eas-cli
else
    echo "✅ EAS CLI is installed"
fi

echo ""
echo "Step 1: Checking Expo login status..."
if eas whoami &> /dev/null; then
    echo "✅ Already logged in to Expo"
    EXPO_USER=$(eas whoami)
    echo "   Logged in as: $EXPO_USER"
else
    echo "❌ Not logged in to Expo"
    echo ""
    echo "Please run the following command to login:"
    echo "   eas login"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo ""
echo "Step 2: Configuring project..."
if [ ! -f "eas.json" ]; then
    echo "❌ eas.json not found. Please ensure it exists."
    exit 1
else
    echo "✅ eas.json found"
fi

# Check if project is linked
echo ""
echo "Step 3: Checking project link..."
if eas project:info &> /dev/null; then
    echo "✅ Project is linked to Expo account"
else
    echo "⚠️  Project not yet linked. Running eas build:configure..."
    eas build:configure || {
        echo "⚠️  Configuration may need manual setup. Continuing..."
    }
fi

echo ""
echo "Step 4: Checking environment variables..."
echo ""
echo "The following environment variables need to be set as EAS secrets:"
echo "  - EXPO_PUBLIC_SUPABASE_URL"
echo "  - EXPO_PUBLIC_SUPABASE_ANON_KEY"
echo "  - EXPO_PUBLIC_EDGE_BASE_URL"
echo ""

# Check if secrets are set
SECRETS_COUNT=$(eas secret:list 2>/dev/null | grep -c "EXPO_PUBLIC" || echo "0")
if [ "$SECRETS_COUNT" -ge "3" ]; then
    echo "✅ Environment variables appear to be configured"
    echo ""
    echo "Current secrets:"
    eas secret:list
else
    echo "⚠️  Environment variables not yet configured"
    echo ""
    echo "Run these commands to set them (replace with your actual values):"
    echo ""
    echo "  eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value your_supabase_url"
    echo "  eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your_supabase_anon_key"
    echo "  eas secret:create --scope project --name EXPO_PUBLIC_EDGE_BASE_URL --value your_edge_function_url"
    echo ""
fi

echo ""
echo "Step 5: Ready to build!"
echo ""
echo "To build for TestFlight, run:"
echo "  eas build --platform ios --profile production"
echo ""
echo "After the build completes, submit to TestFlight with:"
echo "  eas submit --platform ios --latest"
echo ""
echo "Then configure testers in App Store Connect → TestFlight"
echo ""
echo "📖 For detailed instructions, see SETUP_TESTFLIGHT.md"
echo ""


