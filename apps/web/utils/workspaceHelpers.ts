import { createClient } from '@/lib/supabase/client'

export interface Workspace {
  id: string
  name: string
  logo_path?: string | null
  logo_updated_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
  status: string
}

/**
 * Create a new workspace
 * @param name Workspace name
 * @returns Created workspace
 */
export async function createWorkspace(name: string): Promise<Workspace> {
  const supabase = createClient()
  
  // Get current user and verify session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('[createWorkspace] Auth error:', userError)
    throw new Error('User not authenticated')
  }

  // Verify session exists
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('No active session')
  }

  console.log('[createWorkspace] Creating workspace via RPC:', {
    name: name.trim(),
    userId: user.id,
    hasSession: !!session,
  })

  // Try RPC function first (bypasses RLS)
  const { data: workspaceData, error: rpcError } = await supabase.rpc('create_workspace', {
    workspace_name: name.trim(),
  })

  if (!rpcError && workspaceData && workspaceData.length > 0) {
    const workspace = workspaceData[0] as Workspace
    console.log('[createWorkspace] Workspace created via RPC:', workspace.id)
    return workspace
  }

  // Fallback to direct insert if RPC doesn't exist or fails
  console.log('[createWorkspace] RPC failed, trying direct insert:', rpcError)
  
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name: name.trim(),
      created_by: user.id,
      status: 'active',
    })
    .select()
    .single()

  if (workspaceError || !workspace) {
    console.error('[createWorkspace] Error creating workspace:', {
      rpcError,
      insertError: workspaceError,
      code: workspaceError?.code,
      message: workspaceError?.message,
      details: workspaceError?.details,
      hint: workspaceError?.hint,
      userId: user.id,
    })
    throw workspaceError || rpcError || new Error('Failed to create workspace')
  }

  // Add creator as owner
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
      created_by: user.id,
    })

  if (memberError) {
    console.error('[createWorkspace] Error adding owner to workspace:', memberError)
    // Clean up workspace if member creation fails
    await supabase.from('workspaces').delete().eq('id', workspace.id)
    throw memberError
  }

  // Create default tag_config for the workspace
  const { error: tagConfigError } = await supabase
    .from('tag_config')
    .insert({
      workspace_id: workspace.id,
      auto_tags: [],
    })

  if (tagConfigError) {
    // Log but don't fail - tag_config creation is optional
    console.warn('[createWorkspace] Error creating tag_config:', tagConfigError)
  }

  return workspace as Workspace
}

/**
 * Delete a workspace
 * Only workspace owners can delete workspaces
 * @param workspaceId Workspace ID to delete
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const supabase = createClient()
  
  // Get current user and verify session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('[deleteWorkspace] Auth error:', userError)
    throw new Error('User not authenticated')
  }

  // Try RPC function first (bypasses RLS)
  const { error: rpcError } = await supabase.rpc('delete_workspace', {
    workspace_id_param: workspaceId,
  })

  if (!rpcError) {
    console.log('[deleteWorkspace] Workspace deleted via RPC:', workspaceId)
    return
  }

  // Fallback to direct delete if RPC doesn't exist or fails
  console.log('[deleteWorkspace] RPC failed, trying direct delete:', rpcError)
  
  const { error: deleteError } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId)

  if (deleteError) {
    console.error('[deleteWorkspace] Error deleting workspace:', {
      rpcError,
      deleteError,
      code: deleteError?.code,
      message: deleteError?.message,
    })
    throw deleteError || rpcError || new Error('Failed to delete workspace')
  }
}

