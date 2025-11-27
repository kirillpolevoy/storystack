# Check Edge Function Logs for "Bike" Tag

To see if "Bike" was sent to OpenAI, check the edge function logs:

## Steps:

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/myoqdmtcgqejqknxgdjz/functions

2. **Click on `auto_tag_asset` function**

3. **Go to "Logs" tab**

4. **Look for recent logs when photos were imported**

5. **Search for these log messages:**
   - `[auto_tag_asset] ✅ Loaded auto_tags from config: [...]` 
     - This shows what tags were loaded from the database
   - `[auto_tag_asset] Tag vocabulary for GPT-4: [...]`
     - This shows what tags were sent to OpenAI
   - `[auto_tag_asset] Tag vocabulary count: X`
     - Shows how many tags were sent

## What to look for:

- If "Bike" is in the `auto_tags` array in the database, it should appear in:
  - `✅ Loaded auto_tags from config: [...]`
  - `Tag vocabulary for GPT-4: [...]`

- If "Bike" is NOT in `auto_tags`, it won't be sent to OpenAI (even if it's used on photos)

## Quick Check:

Run `CHECK_BIKE_TAG.sql` first to see if "Bike" is in `auto_tags` in the database.

If it's NOT in `auto_tags`, then it definitely wasn't sent to OpenAI (the edge function only uses tags from `auto_tags`).


