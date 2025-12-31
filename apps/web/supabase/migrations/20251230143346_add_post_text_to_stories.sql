-- Add post_text column to stories table
ALTER TABLE stories ADD COLUMN IF NOT EXISTS post_text TEXT;

-- Add comment for documentation
COMMENT ON COLUMN stories.post_text IS 'Text content associated with the story/post that will be included in zip downloads';

