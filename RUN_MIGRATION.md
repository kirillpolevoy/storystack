# Run Migration Script

Since the Supabase CLI doesn't have a direct SQL execution command, you have two options:

## Option 1: Run in Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/20251219134928_ensure_tag_config_for_workspaces.sql`
3. Click "Run"

## Option 2: Use psql (if you have database connection)

If you have the database connection string, you can run:
```bash
psql "YOUR_DATABASE_CONNECTION_STRING" -f supabase/migrations/20251219134928_ensure_tag_config_for_workspaces.sql
```

## What This Migration Does

- Creates `tag_config` entries for all workspaces that don't have one
- Sets `auto_tags` to an empty array (users can enable tags in UI)
- Prevents autotagging from failing when `tag_config` doesn't exist

## After Running

1. Go to `/app/tags` in your app
2. Toggle "Use with AI" for tags you want to use for autotagging
3. Upload a new asset to test autotagging

