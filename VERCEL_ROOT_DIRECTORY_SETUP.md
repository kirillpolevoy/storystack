# Vercel Root Directory Configuration

## Important: Set Root Directory in Vercel Dashboard

For monorepo setups, you **must** configure the Root Directory in Vercel's project settings, NOT in `vercel.json`.

### Steps to Fix:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **General**
3. Scroll down to **Root Directory**
4. Click **Edit**
5. Set Root Directory to: `apps/web`
6. Click **Save**
7. Redeploy your project

### Why?

- `rootDirectory` is NOT a valid property in `vercel.json` (causes schema validation errors)
- Vercel needs to know where your `package.json` with Next.js is located
- The Root Directory setting tells Vercel to treat `apps/web` as the project root
- Once set, Vercel will automatically find `package.json` and detect Next.js

### After Setting Root Directory:

- Vercel will run commands from `apps/web` directory
- `vercel.json` build commands will execute relative to `apps/web`
- Next.js will be automatically detected from `apps/web/package.json`

