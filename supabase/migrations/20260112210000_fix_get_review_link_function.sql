-- Fix get_review_link function to return workspace_name and single row

DROP FUNCTION IF EXISTS get_review_link(UUID);

CREATE OR REPLACE FUNCTION get_review_link(link_id UUID)
RETURNS TABLE (
    id UUID,
    workspace_id UUID,
    name TEXT,
    allowed_tags TEXT[],
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN,
    allow_rating BOOLEAN,
    allow_notes BOOLEAN,
    workspace_name TEXT
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
        rl.allow_notes,
        w.name as workspace_name
    FROM review_links rl
    JOIN workspaces w ON w.id = rl.workspace_id
    WHERE rl.id = link_id
    AND rl.is_active = true
    AND (rl.expires_at IS NULL OR rl.expires_at > NOW())
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION get_review_link(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_review_link(UUID) TO authenticated;
