-- Create a function to delete all storage objects for a user
-- This function will be called by the delete-user edge function

CREATE OR REPLACE FUNCTION delete_user_storage_objects(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  -- Delete all storage objects owned by the user
  DELETE FROM storage.objects
  WHERE owner = user_id_param;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % storage objects for user %', deleted_count, user_id_param;
END;
$$;

COMMENT ON FUNCTION delete_user_storage_objects IS 'Deletes all storage objects owned by a user. Used by delete-user edge function.';

