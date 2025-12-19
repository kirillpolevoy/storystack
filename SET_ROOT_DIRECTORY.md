# How to Set Root Directory in Vercel

## The Problem
Vercel is looking for `package.json` in the repository root, but your Next.js app is in `apps/web/`.

## Solution: Set Root Directory

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Click on your project: **web** (or **kirills-projects-39b715a7/web**)
3. Click **Settings** (gear icon in the top navigation)
4. Look for one of these sections:
   - **Build & Development Settings** → Scroll down to find **Root Directory**
   - **General** → Scroll down (it might be at the bottom)
   - **Build Settings** → Look for **Root Directory**
5. Click **Edit** or the field itself
6. Enter: `apps/web`
7. Click **Save**

### Option 2: Re-import Project (If you can't find the setting)

If you can't find Root Directory anywhere:

1. Go to https://vercel.com/dashboard
2. Click **Add New Project**
3. Import your GitHub repository again
4. **During import**, you'll see a **Root Directory** option
5. Select or type: `apps/web`
6. Complete the import

Then you can delete the old project if needed.

### Option 3: Check Project Settings via URL

Try going directly to:
- `https://vercel.com/[your-team]/[project-name]/settings/general`
- Look for "Root Directory" field

## After Setting Root Directory

1. **Redeploy** your project:
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**

2. Verify the build works:
   - Check the build logs
   - Should see: "Detected Next.js version: 14.x.x"

## Verification

After setting Root Directory and redeploying, you should see in build logs:
```
Detected Next.js version: 14.2.35
```

If you still see "No Next.js version detected", the Root Directory is not set correctly.


