# Stories Feature Implementation Plan

## Overview
Transform StoryStack from an export-focused app to a story/collection management app where stories are persistent collections within the app.

## Current State Analysis

### Campaigns
- **Purpose**: Top-level organization (like "My Library" is a campaign)
- **Schema**: `id`, `user_id`, `name`, `created_at`
- **Relationship**: Assets belong to campaigns via `campaign_id`
- **Usage**: Users have a default campaign, can create multiple campaigns

### Current Flow
1. Import photos → stored in Supabase with `campaign_id`
2. Auto-tag photos
3. Filter by tags
4. Select photos → Build Story → Export to device photo library

### New Flow
1. Import photos → stored in Supabase with `campaign_id`
2. Auto-tag photos
3. Filter by tags
4. Select photos → Add to Story (persistent collection)
5. Stories are viewable/manageable within app
6. Optional: Share/Export story

## Database Schema Changes

### New Table: `stories`
```sql
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stories"
  ON stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stories"
  ON stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories"
  ON stories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
  ON stories FOR DELETE
  USING (auth.uid() = user_id);
```

### New Table: `story_assets` (Junction Table)
```sql
CREATE TABLE story_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, asset_id) -- Prevent duplicate assets in same story
);

-- Indexes for performance
CREATE INDEX idx_story_assets_story_id ON story_assets(story_id);
CREATE INDEX idx_story_assets_asset_id ON story_assets(asset_id);
CREATE INDEX idx_story_assets_order ON story_assets(story_id, order_index);

-- RLS Policies
ALTER TABLE story_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view story assets for their stories"
  ON story_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = story_assets.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add assets to their stories"
  ON story_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = story_assets.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update story assets in their stories"
  ON story_assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = story_assets.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove assets from their stories"
  ON story_assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = story_assets.story_id
      AND stories.user_id = auth.uid()
    )
  );
```

### Updated Types
```typescript
export type Story = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  cover_asset_id?: string;
  created_at: string;
  updated_at: string;
};

export type StoryAsset = {
  id: string;
  story_id: string;
  asset_id: string;
  order_index: number;
  created_at: string;
};

export type StoryWithAssets = Story & {
  assets: Asset[];
  asset_count: number;
};
```

## UI/UX Changes

### 1. Hamburger Menu
- Add hamburger menu icon to LibraryHeader
- Menu items:
  - Stories (new)
  - Tag Management
  - Profile
  - (Maybe: Settings, Help)

### 2. New Stories Screen (`app/stories.tsx`)
- List view of all user's stories
- Search/filter by story name
- Each story shows:
  - Cover photo (first photo or selected cover)
  - Story name
  - Photo count
  - Last updated date
- Actions:
  - Tap to view story detail
  - Swipe to delete
  - Long press for more options

### 3. Story Detail Screen (`app/stories/[id].tsx`)
- Display all photos in story (in order)
- Allow reordering (drag & drop)
- Add/remove photos
- Edit story name/description
- Set cover photo
- Share/Export story (optional)
- Delete story

### 4. Update Story Builder (`app/story-builder.tsx`)
- Change from "Export Story" to "Save Story"
- Allow creating new story or adding to existing
- Story name input
- Optional description
- Save button creates story in database

### 5. Update Library Screen (`app/index.tsx`)
- Change "Build Story" button to "Add to Story"
- When photos selected, show options:
  - "Add to New Story"
  - "Add to Existing Story" (dropdown/picker)
- Remove export functionality (or make it secondary)

## Implementation Steps

### Phase 1: Database Setup
1. Create migration SQL file
2. Create `stories` table
3. Create `story_assets` junction table
4. Set up RLS policies
5. Test RLS policies

### Phase 2: Types & Utilities
1. Update `types.ts` with Story types
2. Create `utils/stories.ts` with CRUD functions:
   - `createStory()`
   - `getStories()`
   - `getStoryById()`
   - `updateStory()`
   - `deleteStory()`
   - `addAssetsToStory()`
   - `removeAssetFromStory()`
   - `reorderStoryAssets()`

### Phase 3: UI Components
1. Create hamburger menu component
2. Create Stories list screen
3. Create Story detail screen
4. Update Story Builder screen
5. Update Library screen

### Phase 4: Integration
1. Update navigation
2. Update LibraryHeader with menu
3. Connect all screens
4. Test full flow

### Phase 5: Polish
1. Add loading states
2. Add error handling
3. Add animations
4. Add haptic feedback
5. Test edge cases

## Migration Strategy

### For Existing Users
- No data migration needed (stories are new feature)
- Existing "sequences" can be ignored or migrated if needed
- Users start fresh with stories feature

### Backward Compatibility
- Keep campaign structure (still needed for asset organization)
- Keep export functionality as optional
- Stories are additive feature

## Future Enhancements (Post-MVP)
- Story collaboration (multi-user)
- Story templates
- Story sharing links
- Story analytics
- Story cover photo selection UI
- Story descriptions/notes














