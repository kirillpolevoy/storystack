# Deployment Checklist

Use this checklist to ensure a smooth production deployment to Vercel.

## Pre-Deployment

- [ ] Code is committed and pushed to repository
- [ ] All tests pass (if applicable)
- [ ] Linter passes (`npm run lint` in `apps/web`)
- [ ] Build succeeds locally (`cd apps/web && npm run build`)
- [ ] Environment variables documented

## Vercel Setup

- [ ] Vercel account created
- [ ] Repository connected to Vercel
- [ ] Root directory set to `apps/web`
- [ ] Framework preset: Next.js (auto-detected)

## Environment Variables

- [ ] `NEXT_PUBLIC_SUPABASE_URL` added to Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` added to Vercel
- [ ] `NEXT_PUBLIC_SITE_URL` added (optional, for logout redirect)
- [ ] Variables set for Production, Preview, and Development environments

## First Deployment

- [ ] Initial deployment triggered
- [ ] Build logs reviewed (no errors)
- [ ] Deployment successful
- [ ] Production URL accessible

## Post-Deployment Testing

- [ ] Homepage loads correctly
- [ ] Authentication (login) works
- [ ] User registration works (if applicable)
- [ ] Asset library loads
- [ ] Image uploads work
- [ ] Image display works
- [ ] Search functionality works
- [ ] Tag filtering works
- [ ] Story creation works
- [ ] Mobile responsive design verified

## Production Verification

- [ ] HTTPS enabled (automatic)
- [ ] Custom domain configured (if applicable)
- [ ] Analytics enabled (optional)
- [ ] Error monitoring set up (optional)
- [ ] Performance monitoring enabled (optional)

## Documentation

- [ ] Team members have access to Vercel dashboard
- [ ] Deployment process documented
- [ ] Environment variables documented securely
- [ ] Rollback procedure understood

## Quick Deploy Commands

### Via Vercel Dashboard
1. Push to main branch → Automatic deployment

### Via CLI
```bash
cd apps/web
vercel --prod
```

### Via GitHub Actions (if configured)
1. Push to main branch → Automatic deployment via workflow

## Troubleshooting

If deployment fails:
1. Check build logs in Vercel dashboard
2. Verify environment variables are set
3. Test build locally: `cd apps/web && npm run build`
4. Check Node.js version compatibility
5. Review error messages in deployment logs

## Rollback Procedure

1. Go to Vercel Dashboard → Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"


