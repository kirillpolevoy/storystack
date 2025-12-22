-- This migration attempts to identify the actual database error
-- by trying to delete a test user directly (if one exists)
-- DO NOT RUN THIS ON PRODUCTION - it's for diagnostic purposes only

-- Create a function to safely check what's blocking user deletion
CREATE OR REPLACE FUNCTION diagnose_user_deletion_block(user_id_to_check UUID)
RETURNS TABLE (
  constraint_name TEXT,
  table_name TEXT,
  column_name TEXT,
  constraint_type TEXT,
  blocking_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.conname::TEXT as constraint_name,
    t.relname::TEXT as table_name,
    a.attname::TEXT as column_name,
    CASE c.contype
      WHEN 'f' THEN 'FOREIGN KEY'
      WHEN 'p' THEN 'PRIMARY KEY'
      WHEN 'u' THEN 'UNIQUE'
      WHEN 'c' THEN 'CHECK'
      ELSE 'OTHER'
    END::TEXT as constraint_type,
    pg_get_constraintdef(c.oid)::TEXT as blocking_reason
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  JOIN pg_class r ON r.oid = c.confrelid
  WHERE r.relname = 'users'
    AND r.relnamespace = 'auth'::regnamespace
    AND c.contype = 'f'
    AND EXISTS (
      SELECT 1
      FROM pg_constraint c2
      WHERE c2.conname = c.conname
        AND pg_get_constraintdef(c2.oid) LIKE '%RESTRICT%'
    );
END;
$$;

COMMENT ON FUNCTION diagnose_user_deletion_block IS 'Diagnostic function to identify constraints blocking user deletion. For troubleshooting only.';

