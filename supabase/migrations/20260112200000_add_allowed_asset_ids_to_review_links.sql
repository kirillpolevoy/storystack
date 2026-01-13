-- Add allowed_asset_ids column to review_links for sharing specific assets
-- This allows users to share a specific selection of assets with clients

ALTER TABLE review_links
ADD COLUMN IF NOT EXISTS allowed_asset_ids UUID[] DEFAULT '{}';

-- Index for better query performance when filtering by asset IDs
CREATE INDEX IF NOT EXISTS idx_review_links_allowed_asset_ids ON review_links USING GIN(allowed_asset_ids);

-- Drop the existing function first (return type is changing)
DROP FUNCTION IF EXISTS get_review_link_assets(UUID);

-- Update the get_review_link_assets function to support asset ID filtering
CREATE OR REPLACE FUNCTION get_review_link_assets(link_id UUID)
RETURNS TABLE (
    id UUID,
    workspace_id UUID,
    storage_path TEXT,
    storage_path_preview TEXT,
    storage_path_thumb TEXT,
    tags TEXT[],
    location TEXT,
    date_taken TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    rating TEXT,
    rating_note TEXT,
    rated_at TIMESTAMPTZ,
    asset_type TEXT,
    thumbnail_frames TEXT[],
    video_duration_seconds DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    review_link RECORD;
BEGIN
    -- Get the review link details
    SELECT rl.workspace_id, rl.allowed_tags, rl.allowed_asset_ids, rl.is_active, rl.expires_at
    INTO review_link
    FROM review_links rl
    WHERE rl.id = link_id;

    -- Check if link exists and is valid
    IF review_link IS NULL THEN
        RETURN;
    END IF;

    IF NOT review_link.is_active THEN
        RETURN;
    END IF;

    IF review_link.expires_at IS NOT NULL AND review_link.expires_at < NOW() THEN
        RETURN;
    END IF;

    -- Return assets based on filtering criteria
    -- Priority: allowed_asset_ids > allowed_tags > all assets
    RETURN QUERY
    SELECT
        a.id,
        a.workspace_id,
        a.storage_path,
        a.storage_path_preview,
        a.storage_path_thumb,
        a.tags,
        a.location,
        a.date_taken,
        a.created_at,
        a.rating,
        a.rating_note,
        a.rated_at,
        a.asset_type,
        a.thumbnail_frames,
        a.video_duration_seconds
    FROM assets a
    WHERE a.workspace_id = review_link.workspace_id
    AND (
        -- If allowed_asset_ids is specified, filter by those IDs
        (array_length(review_link.allowed_asset_ids, 1) > 0 AND a.id = ANY(review_link.allowed_asset_ids))
        OR
        -- Otherwise, if allowed_tags is specified, filter by those tags
        (array_length(review_link.allowed_asset_ids, 1) IS NULL OR array_length(review_link.allowed_asset_ids, 1) = 0) AND (
            array_length(review_link.allowed_tags, 1) IS NULL
            OR array_length(review_link.allowed_tags, 1) = 0
            OR a.tags && review_link.allowed_tags
        )
    )
    ORDER BY a.created_at DESC;
END;
$$;

-- Grant execute permission to anonymous users for public review links
GRANT EXECUTE ON FUNCTION get_review_link_assets(UUID) TO anon;
