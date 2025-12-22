-- Check if active workspace is set incorrectly
-- This could cause stories from other workspaces to show up

SELECT 
  u.id as user_id,
  u.email,
  up.active_workspace_id,
  w.name as active_workspace_name,
  w.created_by as workspace_owner_id,
  u2.email as workspace_owner_email,
  CASE 
    WHEN up.active_workspace_id IS NULL THEN '⚠️ No active workspace set'
    WHEN w.created_by = u.id THEN '✅ Own workspace'
    WHEN EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = up.active_workspace_id
      AND wm.user_id = u.id
    ) THEN '✅ Member of workspace'
    ELSE '❌ NOT a member of active workspace!'
  END as status
FROM auth.users u
LEFT JOIN user_preferences up ON up.user_id = u.id
LEFT JOIN workspaces w ON w.id = up.active_workspace_id
LEFT JOIN auth.users u2 ON u2.id = w.created_by
WHERE u.email IN ('malkari@gmail.com', 'ashmurak@gmail.com', 'kpolevoy@gmail.com')
ORDER BY u.email;

