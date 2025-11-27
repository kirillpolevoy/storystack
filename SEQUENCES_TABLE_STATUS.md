# Sequences Table Status

## Current State

The `sequences` table exists in your database but is **not currently used** by the application.

### How Export Currently Works

1. User selects photos in story builder
2. User enters a story name
3. Photos are downloaded from Supabase storage
4. Photos are saved to device's media library as an album
5. **Nothing is saved to the database**

### Why Sequences Table Exists

The table was likely created for future functionality to:
- Save story sequences for later editing
- Allow users to re-export stories
- Share story templates

## Recommendation

Since the table is empty and not used, you have two options:

### Option 1: Add user_id Now (Recommended)
Run `ADD_SEQUENCES_USER_ID_FINAL.sql` to:
- Add `user_id` column
- Set up RLS policies
- Prepare for future use

**Pros:** Ready when you add sequence saving feature
**Cons:** Extra migration step now

### Option 2: Leave It As-Is
Keep the table without `user_id` for now.

**Pros:** Less work now
**Cons:** Will need migration later when you add sequence saving

## If You Add Sequence Saving Later

When you implement sequence saving, you'll need to:

1. Update `app/story-builder.tsx` to save sequences:
```typescript
const saveSequence = async () => {
  const { data, error } = await supabase
    .from('sequences')
    .insert({
      user_id: user.id,
      campaign_id: campaignId,
      name: storyName,
      asset_order: assets.map(a => a.id),
    });
};
```

2. Add UI to load saved sequences
3. Allow users to edit/re-export saved sequences

## Current Export Flow

```
User selects photos → Story Builder → Export → Device Media Library
                                              ↓
                                    (No database save)
```

## Future Flow (if you add sequence saving)

```
User selects photos → Story Builder → Save Sequence → Database
                                    ↓
                              Export → Device Media Library
```


