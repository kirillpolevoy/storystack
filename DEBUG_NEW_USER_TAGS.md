# Debug: New User Seeing Default Tags

## Where could tags be coming from?

1. **Tag Management Screen** - Shows tags from:
   - Tags on assets (photos) - `assets.tags`
   - Custom tags - `tag_config.custom_tags`
   - ❌ No longer includes STORYSTACK_TAGS

2. **Tag Filter Bar** - Shows tags from:
   - `getAllAvailableTags()` which gets tags from assets and custom_tags
   - ❌ No longer includes STORYSTACK_TAGS

3. **Tag Modal** - Shows tags from:
   - `getAllAvailableTags()` 
   - ❌ No longer includes STORYSTACK_TAGS

## Possible Issues:

1. **App Cache** - Old code might be cached. User needs to:
   - Close and restart the app
   - Or clear app data/cache

2. **AsyncStorage** - Old default tags might be in AsyncStorage from previous app version
   - But AsyncStorage is only used for `auto_tags` (which tags are enabled), not the tag list itself

3. **Database** - Tags might be in:
   - `assets.tags` (if user imported photos with default tags)
   - `tag_config.custom_tags` (if somehow set)
   - `tag_config.auto_tags` (these are just enabled tags, not the list)

## Check:

Run `CHECK_USER_DEFAULT_TAGS.sql` to see:
- Are there any photos with default tags?
- Are default tags in custom_tags?
- Are default tags in auto_tags?

If all are empty, then it's likely:
- App cache issue (restart app)
- Or tags are showing in a different screen (Tag Filter Bar, Tag Modal) from old cached data


