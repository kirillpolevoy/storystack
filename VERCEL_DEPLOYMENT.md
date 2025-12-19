# Vercel Production Deployment Guide

This guide will help you deploy the StoryStack web application to Vercel.

## Prerequisites

- A GitHub, GitLab, or Bitbucket account with your code repository
- A Vercel account (sign up at [vercel.com](https://vercel.com))
- Your Supabase project credentials

## Quick Setup

### 1. Connect Your Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your Git repository (GitHub/GitLab/Bitbucket)
4. Vercel will auto-detect it's a Next.js project

### 2. Configure Project Settings

**Root Directory:** Set to `apps/web`

**Framework Preset:** Next.js (auto-detected)

**Build Command:** `cd apps/web && npm ci && npm run build` (or leave default)

**Output Directory:** `.next` (default, Vercel handles this automatically)

**Install Command:** `cd apps/web && npm ci` (or leave default)

### 3. Set Environment Variables

In your Vercel project settings, go to **Settings → Environment Variables** and add:

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `NEXT_PUBLIC_SITE_URL` | Your production site URL (optional) | `https://your-app.vercel.app` |

**Important:** 
- Set these for **Production**, **Preview**, and **Development** environments
- After adding variables, trigger a new deployment

### 4. Deploy

1. Click **"Deploy"**
2. Vercel will:
   - Install dependencies
   - Build your Next.js app
   - Deploy to production
3. Your app will be live at `https://your-project.vercel.app`

## Automatic Deployments

Vercel automatically deploys:
- **Production:** Every push to your main/master branch
- **Preview:** Every push to other branches and pull requests

## Manual Deployment via CLI

### Install Vercel CLI

```bash
npm i -g vercel
```

### Login

```bash
vercel login
```

### Deploy

From the project root:

```bash
cd apps/web
vercel
```

For production deployment:

```bash
vercel --prod
```

## Environment-Specific Configuration

### Production Environment

- Set `NEXT_PUBLIC_SITE_URL` to your production domain
- Ensure all environment variables are set correctly
- Test authentication flows

### Preview/Development Environments

- Use the same Supabase credentials (or create separate projects for staging)
- Preview URLs are automatically generated for each branch/PR

## Troubleshooting

### Build Failures

1. **Check build logs** in Vercel dashboard
2. **Verify Node.js version** - Vercel uses Node 18.x by default
3. **Check dependencies** - Ensure all required packages are in `package.json`

### Environment Variables Not Working

1. **Redeploy** after adding environment variables
2. **Check variable names** - Must match exactly (case-sensitive)
3. **Verify public variables** - Use `NEXT_PUBLIC_` prefix for client-side variables

### Monorepo Issues

If Vercel doesn't detect the root directory correctly:

1. Go to **Project Settings → General**
2. Set **Root Directory** to `apps/web`
3. Save and redeploy

### Database Connection Issues

1. **Check Supabase URL** - Must be correct and accessible
2. **Verify RLS policies** - Ensure they allow public access where needed
3. **Check CORS settings** - Supabase should allow requests from your Vercel domain

## Custom Domain Setup

1. Go to **Project Settings → Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. SSL certificates are automatically provisioned

## Performance Optimization

Vercel automatically provides:
- ✅ Edge Network (CDN)
- ✅ Automatic HTTPS
- ✅ Serverless Functions
- ✅ Image Optimization
- ✅ Analytics (optional)

## Monitoring

- **Deployment logs** - Available in Vercel dashboard
- **Function logs** - Check serverless function execution
- **Analytics** - Enable in project settings (optional)

## Rollback

To rollback to a previous deployment:

1. Go to **Deployments** tab
2. Find the deployment you want to restore
3. Click **"..."** → **"Promote to Production"**

## Next Steps

After deployment:

1. ✅ Test authentication flows
2. ✅ Verify asset uploads work
3. ✅ Check image loading and optimization
4. ✅ Test on mobile devices
5. ✅ Set up custom domain (optional)
6. ✅ Configure analytics (optional)
7. ✅ Set up monitoring/alerts (optional)

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Vercel Support](https://vercel.com/support)


