# Vercel Deployment Issue - Root Directory

## Problem
Vercel is looking for `~/storystack/apps/web/apps/web` which doesn't exist.

## Solution

The Vercel project settings have the wrong root directory. Fix it:

### Option 1: Fix via Vercel Dashboard (Easiest)

1. Go to: https://vercel.com/kirills-projects-39b715a7/web/settings
2. Go to **"General"** settings
3. Find **"Root Directory"**
4. Set it to: `apps/web` (relative to repo root)
5. Save and redeploy

### Option 2: Deploy from Repo Root

If you're deploying from the monorepo root:

```bash
cd /Users/kpolevoy/storystack
vercel --cwd apps/web --prod
```

### Option 3: Update Vercel Config

Or update the project settings via CLI (if supported):

```bash
cd apps/web
vercel project ls
# Then update root directory in dashboard
```

## After Fixing

Once root directory is set correctly:
```bash
cd apps/web
vercel --prod
```

## Alternative: Deploy via Git Push

If you push to your main branch, Vercel will auto-deploy with correct settings:
```bash
git add .
git commit -m "Deploy web app with backward compatibility"
git push origin main
```

