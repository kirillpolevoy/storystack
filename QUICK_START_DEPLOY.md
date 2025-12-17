# Quick Start: Deploy to Vercel

## 🚀 Get Your App Live in 5 Minutes

### Step 1: Push Your Code
```bash
git add .
git commit -m "Setup Vercel deployment"
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your Git repository
4. **Important:** Set **Root Directory** to `apps/web`
5. Click **"Deploy"**

### Step 3: Add Environment Variables

After the first deployment attempt, go to **Settings → Environment Variables** and add:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Set these for **Production**, **Preview**, and **Development**.

### Step 4: Redeploy

1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Your app is now live! 🎉

## 📋 What Was Set Up

✅ `vercel.json` - Vercel configuration for monorepo
✅ `.vercelignore` - Files to exclude from deployment
✅ `.github/workflows/vercel-deploy.yml` - CI/CD workflow (optional)
✅ `VERCEL_DEPLOYMENT.md` - Full deployment guide
✅ `DEPLOYMENT_CHECKLIST.md` - Pre-flight checklist

## 🔄 Automatic Deployments

- **Production:** Every push to `main` branch
- **Preview:** Every PR and branch push

## 🛠️ Manual Deployment

```bash
cd apps/web
npm install -g vercel
vercel login
vercel --prod
```

## 📚 Next Steps

1. ✅ Test your deployed app
2. ✅ Set up custom domain (optional)
3. ✅ Configure analytics (optional)
4. ✅ Review `VERCEL_DEPLOYMENT.md` for advanced options

## ❓ Need Help?

Check `VERCEL_DEPLOYMENT.md` for detailed troubleshooting and configuration options.

