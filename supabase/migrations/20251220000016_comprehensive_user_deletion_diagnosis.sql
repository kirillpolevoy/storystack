-- Comprehensive diagnosis for user deletion issues
-- This will help identify ALL possible blockers

-- 1. Check ALL foreign key constraints (including in auth schema)
CREATE OR REPLACE FUNCTION find_all_user_references(target_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  schema_name TEXT,
  table_name TEXT,
  column_name TEXT,
  constraint_name TEXT,
  constraint_def TEXT,
  delete_action TEXT,
  has_data BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.table_schema::TEXT,
    tc.table_name::TEXT,
    kcu.column_name::TEXT,
    tc.constraint_name::TEXT,
    pg_get_constraintdef(c.oid)::TEXT as constraint_def,
    CASE 
      WHEN pg_get_constraintdef(c.oid) LIKE '%ON DELETE RESTRICT%' THEN 'RESTRICT'
      WHEN pg_get_constraintdef(c.oid) LIKE '%ON DELETE CASCADE%' THEN 'CASCADE'
      WHEN pg_get_constraintdef(c.oid) LIKE '%ON DELETE SET NULL%' THEN 'SET NULL'
      WHEN pg_get_constraintdef(c.oid) LIKE '%ON DELETE NO ACTION%' THEN 'NO ACTION'
      ELSE 'DEFAULT (RESTRICT)'
    END::TEXT as delete_action,
    CASE 
      WHEN target_user_id IS NOT NULL THEN
        EXISTS (
          SELECT 1 
          FROM information_schema.columns col
          WHERE col.table_schema = tc.table_schema
            AND col.table_name = tc.table_name
            AND col.column_name = kcu.column_name
          LIMIT 1
        ) AND EXISTS (
          SELECT 1
          FROM pg_class t
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = tc.table_schema
            AND t.relname = tc.table_name
          LIMIT 1
        )
      ELSE false
    END as has_data
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  JOIN pg_constraint c ON c.conname = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth'
  ORDER BY 
    CASE WHEN pg_get_constraintdef(c.oid) LIKE '%RESTRICT%' OR pg_get_constraintdef(c.oid) NOT LIKE '%ON DELETE%' THEN 0 ELSE 1 END,
    tc.table_schema,
    tc.table_name;
END;
$$;

-- 2. Check for storage objects
CREATE OR REPLACE FUNCTION check_user_storage_objects(target_user_id UUID)
RETURNS TABLE (
  bucket_id TEXT,
  object_count BIGINT,
  total_size BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.bucket_id::TEXT,
    COUNT(*)::BIGINT as object_count,
    SUM(COALESCE(o.metadata->>'size', '0')::BIGINT) as total_size
  FROM storage.objects o
  WHERE o.owner = target_user_id
  GROUP BY o.bucket_id;
END;
$$;

-- 3. Check for active sessions
CREATE OR REPLACE FUNCTION check_user_sessions(target_user_id UUID)
RETURNS TABLE (
  session_count BIGINT,
  active_session_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as session_count,
    COUNT(*) FILTER (WHERE expires_at > NOW())::BIGINT as active_session_count
  FROM auth.sessions
  WHERE user_id = target_user_id;
END;
$$;

-- 4. Try to delete the user directly and return the result
CREATE OR REPLACE FUNCTION test_user_deletion(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  error_message TEXT;
  error_detail TEXT;
  error_hint TEXT;
  rows_deleted INT;
BEGIN
  BEGIN
    -- Check if user exists first
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
      RETURN 'SUCCESS: User does not exist (already deleted)';
    END IF;
    
    -- Attempt deletion
    DELETE FROM auth.users WHERE id = target_user_id;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    IF rows_deleted > 0 THEN
      RETURN 'SUCCESS: User deleted (' || rows_deleted || ' row(s) deleted)';
    ELSE
      RETURN 'SUCCESS: User not found (already deleted)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS 
      error_message = MESSAGE_TEXT,
      error_detail = PG_EXCEPTION_DETAIL,
      error_hint = PG_EXCEPTION_HINT;
    RETURN 'ERROR: ' || error_message || 
           COALESCE(' | Detail: ' || error_detail, '') ||
           COALESCE(' | Hint: ' || error_hint, '');
  END;
END;
$$;

COMMENT ON FUNCTION find_all_user_references IS 'Finds all foreign key constraints referencing auth.users';
COMMENT ON FUNCTION check_user_storage_objects IS 'Checks for storage objects owned by a user';
COMMENT ON FUNCTION check_user_sessions IS 'Checks for active sessions for a user';
COMMENT ON FUNCTION test_user_deletion IS 'Attempts user deletion and returns the actual error message';

