# Deploy to Vercel - Quick Guide

## Build Status ✅
Build completed successfully! Ready to deploy.

## Option 1: Deploy via Vercel CLI (Recommended)

```bash
cd apps/web
vercel --prod
```

If not logged in:
```bash
vercel login
vercel --prod
```

## Option 2: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find your project (or create new one)
3. Click **"Deploy"** or push to your main branch
4. Vercel will auto-deploy

## Environment Variables

Make sure these are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (optional)

## Root Directory

If deploying from monorepo root, set:
- **Root Directory:** `apps/web`
- **Build Command:** `npm ci && npm run build`
- **Output Directory:** `.next` (auto-detected)

## After Deployment

✅ Test authentication
✅ Test asset uploads
✅ Test tag management
✅ Test workspace features

