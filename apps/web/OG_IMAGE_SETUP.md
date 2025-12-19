# Open Graph Image Setup

## Quick Solution: Create Static Image

The most reliable way to get Open Graph images working is to use a static PNG file.

### Option 1: Use the HTML Generator (Easiest)

1. Open `public/create-og-image.html` in your browser
2. Click "Download as PNG"
3. Save the file as `og-image.png` in the `public/` folder
4. Commit and push the file

### Option 2: Use Online Tools

1. Go to one of these tools:
   - **Canva**: https://www.canva.com/ (search for "Open Graph" templates)
   - **OG Image Generator**: https://og-image.vercel.app/
   - **Bannerbear**: https://www.bannerbear.com/tools/open-graph-image-generator/

2. Create an image with these specs:
   - **Size**: 1200x630 pixels
   - **Format**: PNG
   - **Content**: Include your logo, "StoryStack" text, and "storystackstudios.com"

3. Save as `og-image.png` in `apps/web/public/` folder

### Option 3: Use ImageMagick Script

If you have ImageMagick installed:

```bash
cd apps/web
node scripts/create-og-image.js
```

This will create `public/og-image.png` from your existing `logo.png`.

## Current Configuration

The app is configured to use `/og-image.png` as the Open Graph image. Once you create this file:

1. Place it in `apps/web/public/og-image.png`
2. Commit and push
3. Deploy to Vercel
4. Test with Facebook Debugger: https://developers.facebook.com/tools/debug/

## Fallback

If `og-image.png` doesn't exist, the dynamic `opengraph-image.tsx` will be used as a fallback, but static files are more reliable for social media crawlers.

