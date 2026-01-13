-- =============================================
-- Video Support, Asset Rating, and Share Links Migration
-- =============================================

-- 1. Add video-related columns to assets table
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'image' CHECK (asset_type IN ('image', 'video')),
ADD COLUMN IF NOT EXISTS thumbnail_frames TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS video_duration_seconds DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS video_width INTEGER,
ADD COLUMN IF NOT EXISTS video_height INTEGER;

-- Index for filtering by asset type
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);

-- 2. Add rating columns to assets table
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS rating TEXT CHECK (rating IN ('approved', 'maybe', 'rejected')),
ADD COLUMN IF NOT EXISTS rating_note TEXT,
ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for filtering by rating
CREATE INDEX IF NOT EXISTS idx_assets_rating ON assets(rating) WHERE rating IS NOT NULL;

-- 3. Create review_links table for client review functionality
CREATE TABLE IF NOT EXISTS review_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Review Link',
    allowed_tags TEXT[] DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    allow_rating BOOLEAN NOT NULL DEFAULT true,
    allow_notes BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_links_workspace ON review_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_review_links_active ON review_links(is_active) WHERE is_active = true;

-- 4. Create story_links table for public story sharing
CREATE TABLE IF NOT EXISTS story_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Share Link',
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    view_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_story_links_story ON story_links(story_id);
CREATE INDEX IF NOT EXISTS idx_story_links_active ON story_links(is_active) WHERE is_active = true;

-- 5. Enable RLS on new tables
ALTER TABLE review_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_links ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for review_links (workspace members can manage)
CREATE POLICY "review_links_select_policy"
    ON review_links FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = review_links.workspace_id
            AND workspace_members.user_id = auth.uid()
        )
    );

CREATE POLICY "review_links_insert_policy"
    ON review_links FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = review_links.workspace_id
            AND workspace_members.user_id = auth.uid()
        )
    );

CREATE POLICY "review_links_update_policy"
    ON review_links FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = review_links.workspace_id
            AND workspace_members.user_id = auth.uid()
        )
    );

CREATE POLICY "review_links_delete_policy"
    ON review_links FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = review_links.workspace_id
            AND workspace_members.user_id = auth.uid()
        )
    );

-- 7. RLS Policies for story_links (workspace members via story can manage)
CREATE POLICY "story_links_select_policy"
    ON story_links FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM stories s
            JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = story_links.story_id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "story_links_insert_policy"
    ON story_links FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM stories s
            JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = story_links.story_id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "story_links_update_policy"
    ON story_links FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM stories s
            JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = story_links.story_id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "story_links_delete_policy"
    ON story_links FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM stories s
            JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
            WHERE s.id = story_links.story_id
            AND wm.user_id = auth.uid()
        )
    );

-- 8. Function to get review link details (for public access)
CREATE OR REPLACE FUNCTION get_review_link(link_id UUID)
RETURNS TABLE (
    id UUID,
    workspace_id UUID,
    name TEXT,
    allowed_tags TEXT[],
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN,
    allow_rating BOOLEAN,
    allow_notes BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rl.id,
        rl.workspace_id,
        rl.name,
        rl.allowed_tags,
        rl.expires_at,
        rl.is_active,
        rl.allow_rating,
        rl.allow_notes
    FROM review_links rl
    WHERE rl.id = link_id
    AND rl.is_active = true
    AND (rl.expires_at IS NULL OR rl.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to get story link details (for public access)
CREATE OR REPLACE FUNCTION get_story_link(link_id UUID)
RETURNS TABLE (
    id UUID,
    story_id UUID,
    name TEXT,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN,
    view_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.id,
        sl.story_id,
        sl.name,
        sl.expires_at,
        sl.is_active,
        sl.view_count
    FROM story_links sl
    WHERE sl.id = link_id
    AND sl.is_active = true
    AND (sl.expires_at IS NULL OR sl.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to get assets for a review link (for public access)
CREATE OR REPLACE FUNCTION get_review_link_assets(link_id UUID)
RETURNS TABLE (
    id UUID,
    workspace_id UUID,
    storage_path TEXT,
    storage_path_preview TEXT,
    storage_path_thumb TEXT,
    asset_type TEXT,
    thumbnail_frames TEXT[],
    video_duration_seconds DECIMAL,
    video_width INTEGER,
    video_height INTEGER,
    tags TEXT[],
    rating TEXT,
    rating_note TEXT,
    location TEXT,
    date_taken TIMESTAMPTZ,
    original_filename TEXT,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    review_link review_links%ROWTYPE;
BEGIN
    -- Get the review link
    SELECT * INTO review_link
    FROM review_links rl
    WHERE rl.id = link_id
    AND rl.is_active = true
    AND (rl.expires_at IS NULL OR rl.expires_at > NOW());

    -- Return empty if link not found or expired
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Return assets based on allowed_tags filter
    RETURN QUERY
    SELECT
        a.id,
        a.workspace_id,
        a.storage_path,
        a.storage_path_preview,
        a.storage_path_thumb,
        a.asset_type,
        a.thumbnail_frames,
        a.video_duration_seconds,
        a.video_width,
        a.video_height,
        a.tags,
        a.rating,
        a.rating_note,
        a.location,
        a.date_taken,
        a.original_filename,
        a.created_at
    FROM assets a
    WHERE a.workspace_id = review_link.workspace_id
    AND a.deleted_at IS NULL
    AND (
        review_link.allowed_tags = '{}'
        OR review_link.allowed_tags IS NULL
        OR a.tags && review_link.allowed_tags
    )
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to update asset rating via review link (for public access)
CREATE OR REPLACE FUNCTION update_asset_rating_via_review_link(
    p_link_id UUID,
    p_asset_id UUID,
    p_rating TEXT,
    p_rating_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    review_link review_links%ROWTYPE;
    asset_workspace_id UUID;
BEGIN
    -- Get the review link
    SELECT * INTO review_link
    FROM review_links rl
    WHERE rl.id = p_link_id
    AND rl.is_active = true
    AND rl.allow_rating = true
    AND (rl.expires_at IS NULL OR rl.expires_at > NOW());

    -- Return false if link not found, expired, or doesn't allow rating
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Get the asset's workspace
    SELECT workspace_id INTO asset_workspace_id
    FROM assets
    WHERE id = p_asset_id
    AND deleted_at IS NULL;

    -- Verify asset belongs to the review link's workspace
    IF asset_workspace_id IS NULL OR asset_workspace_id != review_link.workspace_id THEN
        RETURN false;
    END IF;

    -- Verify asset matches allowed_tags if specified
    IF review_link.allowed_tags != '{}' AND review_link.allowed_tags IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM assets
            WHERE id = p_asset_id
            AND tags && review_link.allowed_tags
        ) THEN
            RETURN false;
        END IF;
    END IF;

    -- Update the rating
    UPDATE assets
    SET
        rating = p_rating,
        rating_note = CASE WHEN review_link.allow_notes THEN p_rating_note ELSE rating_note END,
        rated_at = CASE WHEN p_rating IS NOT NULL THEN NOW() ELSE NULL END
    WHERE id = p_asset_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to get story with assets via story link (for public access)
-- Returns JSON with story info and assets array
CREATE OR REPLACE FUNCTION get_story_via_link(p_link_id UUID)
RETURNS JSON AS $$
DECLARE
    story_link story_links%ROWTYPE;
    result JSON;
BEGIN
    -- Get the story link
    SELECT * INTO story_link
    FROM story_links sl
    WHERE sl.id = p_link_id
    AND sl.is_active = true
    AND (sl.expires_at IS NULL OR sl.expires_at > NOW());

    -- Return null if link not found or expired
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Build the JSON response
    SELECT json_build_object(
        'story_id', s.id,
        'story_name', s.name,
        'story_description', s.description,
        'link_name', story_link.name,
        'assets', COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'id', a.id,
                    'order_index', sa.order_index,
                    'storage_path', a.storage_path,
                    'storage_path_preview', a.storage_path_preview,
                    'storage_path_thumb', a.storage_path_thumb,
                    'asset_type', a.asset_type,
                    'thumbnail_frames', a.thumbnail_frames,
                    'video_duration_seconds', a.video_duration_seconds,
                    'video_width', a.video_width,
                    'video_height', a.video_height,
                    'tags', a.tags
                ) ORDER BY sa.order_index
            )
            FROM story_assets sa
            JOIN assets a ON a.id = sa.asset_id
            WHERE sa.story_id = s.id
            AND a.deleted_at IS NULL
        ), '[]'::json)
    ) INTO result
    FROM stories s
    WHERE s.id = story_link.story_id
    AND s.deleted_at IS NULL;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12b. Function to increment story link view count (separate from get to avoid double counting)
CREATE OR REPLACE FUNCTION increment_story_link_view(p_link_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE story_links
    SET view_count = view_count + 1
    WHERE id = p_link_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Grant execute permissions on functions to anon role (for public access)
GRANT EXECUTE ON FUNCTION get_review_link(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_story_link(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_review_link_assets(UUID) TO anon;
GRANT EXECUTE ON FUNCTION update_asset_rating_via_review_link(UUID, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_story_via_link(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_story_link_view(UUID) TO anon;

-- Also grant to authenticated users
GRANT EXECUTE ON FUNCTION get_review_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_story_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_review_link_assets(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_asset_rating_via_review_link(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_story_via_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_story_link_view(UUID) TO authenticated;
