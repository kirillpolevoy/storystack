# Test Edge Function Directly

To verify the edge function can read your tags, test it manually:

## 1. Get a recent asset ID

```sql
SELECT id, user_id, tags, created_at
FROM assets
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
ORDER BY created_at DESC
LIMIT 1;
```

## 2. Get the asset's public URL

```sql
SELECT 
    id,
    storage_path,
    (SELECT data->>'publicUrl' FROM (
        SELECT storage.from('assets').get_public_url(storage_path) as data
    ) sub) as public_url
FROM assets
WHERE id = 'YOUR_ASSET_ID_HERE'::uuid;
```

Or use Supabase Storage to get the public URL manually.

## 3. Test Edge Function

Replace `YOUR_PROJECT_URL` and `YOUR_ANON_KEY`:

```bash
curl -X POST https://YOUR_PROJECT_URL.supabase.co/functions/v1/auto_tag_asset \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "YOUR_ASSET_ID_HERE",
    "imageUrl": "YOUR_PUBLIC_URL_HERE"
  }'
```

## 4. Check Response

Should return:
```json
{
  "assetId": "...",
  "tags": ["Tag1", "Tag2", ...]
}
```

If it returns empty tags `[]`, check edge function logs for why.


