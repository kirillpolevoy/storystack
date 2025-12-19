# Open Graph Setup Guide

## What Was Added

Open Graph metadata has been added to your root layout (`apps/web/app/layout.tsx`). This enables rich previews when your site is shared on social media platforms like Twitter, Facebook, LinkedIn, etc.

## What You Need to Do

### 1. Add Open Graph Image

Create an Open Graph image (`og-image.png`) and place it in your `public` folder:

**Requirements:**
- **Size:** 1200x630 pixels (recommended)
- **Format:** PNG or JPG
- **Location:** `apps/web/public/og-image.png`
- **Content:** Should represent your app/brand

**Quick Option:** Use a tool like:
- https://www.canva.com/ (free templates)
- https://og-image.vercel.app/ (generate programmatically)

### 2. Set Site URL Environment Variable (Optional but Recommended)

Add to Vercel environment variables:

**Key:** `NEXT_PUBLIC_SITE_URL`
**Value:** `https://web-eight-jet-39.vercel.app` (or your production domain)

This ensures Open Graph URLs are correct in production.

### 3. Test Your Open Graph Tags

After deploying:

1. **Facebook Debugger:**
   - https://developers.facebook.com/tools/debug/
   - Enter your URL and click "Scrape Again"

2. **Twitter Card Validator:**
   - https://cards-dev.twitter.com/validator
   - Enter your URL to preview

3. **LinkedIn Post Inspector:**
   - https://www.linkedin.com/post-inspector/
   - Enter your URL

## Customize Per Page (Optional)

You can override Open Graph tags for specific pages:

```typescript
// apps/web/app/some-page/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Specific Page Title',
  description: 'Page-specific description',
  openGraph: {
    title: 'Specific Page Title',
    description: 'Page-specific description',
    images: ['/page-specific-image.png'],
  },
}
```

## Current Configuration

The root layout now includes:
- ✅ Basic Open Graph tags (og:title, og:description, og:type, og:url, og:image)
- ✅ Twitter Card tags (summary_large_image)
- ✅ Site name and locale
- ✅ Robots meta tags (index, follow)

## Next Steps

1. Create/add `og-image.png` to `apps/web/public/`
2. (Optional) Add `NEXT_PUBLIC_SITE_URL` to Vercel env vars
3. Deploy and test with the validators above

