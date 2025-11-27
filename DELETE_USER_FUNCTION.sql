-- Function to delete the auth user after all data is deleted
-- This function must be called AFTER all user data has been deleted
-- It uses the service role to delete the auth user

CREATE OR REPLACE FUNCTION delete_auth_user(user_id_to_delete UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify that the user is deleting themselves
  IF auth.uid() != user_id_to_delete THEN
    RAISE EXCEPTION 'You can only delete your own account';
  END IF;

  -- Delete the auth user using the auth schema
  -- Note: This requires the function to run with elevated privileges
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_auth_user(UUID) TO authenticated;

