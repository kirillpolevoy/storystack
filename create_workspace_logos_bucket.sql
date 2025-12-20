-- Create workspace_logos bucket
-- Run this in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace_logos',
  'workspace_logos',
  true, -- Public bucket (logos need to be accessible)
  5242880, -- 5MB limit (5 * 1024 * 1024 bytes)
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

