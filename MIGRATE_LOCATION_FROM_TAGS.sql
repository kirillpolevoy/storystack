-- Migrate location from tags array to location column
-- This migrates existing location tags (both "Location: City" format and legacy "location" format)
-- to the new location column, then removes location tags from the tags array

-- Step 1: Extract location from tags and populate location column
-- Handle both "Location: City" format and legacy "location" format
UPDATE assets
SET location = CASE
  -- Extract from "Location: City" format
  WHEN EXISTS (
    SELECT 1 FROM unnest(tags) AS tag 
    WHERE tag LIKE 'Location: %'
  ) THEN (
    SELECT TRIM(REPLACE(tag, 'Location:', ''))
    FROM unnest(tags) AS tag 
    WHERE tag LIKE 'Location: %'
    LIMIT 1
  )
  -- Extract from legacy "location" format (case-insensitive)
  WHEN EXISTS (
    SELECT 1 FROM unnest(tags) AS tag 
    WHERE LOWER(tag) = 'location'
  ) THEN (
    SELECT tag
    FROM unnest(tags) AS tag 
    WHERE LOWER(tag) = 'location'
    LIMIT 1
  )
  ELSE NULL
END
WHERE location IS NULL
  AND tags IS NOT NULL
  AND (
    -- Has location tag in "Location: City" format
    EXISTS (
      SELECT 1 FROM unnest(tags) AS tag 
      WHERE tag LIKE 'Location: %'
    )
    OR
    -- Has legacy location tag
    EXISTS (
      SELECT 1 FROM unnest(tags) AS tag 
      WHERE LOWER(tag) = 'location'
    )
  );

-- Step 2: Remove location tags from tags array
-- Remove both "Location: City" format and legacy "location" format
UPDATE assets
SET tags = (
  SELECT ARRAY_AGG(tag)
  FROM unnest(tags) AS tag
  WHERE tag NOT LIKE 'Location: %'
    AND LOWER(tag) != 'location'
)
WHERE tags IS NOT NULL
  AND (
    -- Has location tag in "Location: City" format
    EXISTS (
      SELECT 1 FROM unnest(tags) AS tag 
      WHERE tag LIKE 'Location: %'
    )
    OR
    -- Has legacy location tag
    EXISTS (
      SELECT 1 FROM unnest(tags) AS tag 
      WHERE LOWER(tag) = 'location'
    )
  );

-- Verify migration
-- Check how many assets have location in column vs tags
SELECT 
  COUNT(*) FILTER (WHERE location IS NOT NULL) AS assets_with_location_column,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM unnest(tags) AS tag 
    WHERE tag LIKE 'Location: %' OR LOWER(tag) = 'location'
  )) AS assets_with_location_in_tags,
  COUNT(*) AS total_assets
FROM assets;


