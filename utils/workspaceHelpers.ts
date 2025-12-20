import { supabase } from '@/lib/supabase';
import { Workspace, WorkspaceMember, WorkspaceRole, UserPreferences } from '@/types';

/**
 * Get all workspaces that the current user belongs to
 */
export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      workspace_id,
      role,
      workspaces (
        id,
        name,
        logo_path,
        logo_updated_at,
        created_by,
        created_at,
        updated_at,
        status
      )
    `)
    .eq('user_id', userId)
    .eq('workspaces.status', 'active');

  if (error) {
    console.error('[workspaceHelpers] Error fetching user workspaces:', error);
    throw error;
  }

  // Transform the nested data structure
  return (data || []).map((member: any) => ({
    ...member.workspaces,
  })) as Workspace[];
}

/**
 * Get user's role in a specific workspace
 */
export async function getWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not a member
      return null;
    }
    console.error('[workspaceHelpers] Error fetching workspace role:', error);
    throw error;
  }

  return data?.role as WorkspaceRole | null;
}

/**
 * Check if user has minimum required role in workspace
 * Role hierarchy: owner > admin > editor > viewer
 */
export function hasWorkspacePermission(
  userRole: WorkspaceRole | null,
  minRole: WorkspaceRole
): boolean {
  if (!userRole) {
    return false;
  }

  const roleHierarchy: Record<WorkspaceRole, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    viewer: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}

/**
 * Create a new workspace
 */
export async function createWorkspace(
  name: string,
  userId: string,
  logoFile?: File
): Promise<Workspace> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  // Create workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name,
      created_by: userId,
      status: 'active',
    })
    .select()
    .single();

  if (workspaceError || !workspace) {
    console.error('[workspaceHelpers] Error creating workspace:', workspaceError);
    throw workspaceError || new Error('Failed to create workspace');
  }

  // Add creator as owner
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner',
      created_by: userId,
    });

  if (memberError) {
    console.error('[workspaceHelpers] Error adding owner to workspace:', memberError);
    // Clean up workspace if member creation fails
    await supabase.from('workspaces').delete().eq('id', workspace.id);
    throw memberError;
  }

  // Upload logo if provided
  if (logoFile) {
    try {
      await uploadWorkspaceLogo(workspace.id, logoFile, userId);
      // Refetch workspace to get updated logo_path
      const { data: updatedWorkspace } = await supabase
        .from('workspaces')
        .select()
        .eq('id', workspace.id)
        .single();
      if (updatedWorkspace) {
        return updatedWorkspace as Workspace;
      }
    } catch (logoError) {
      console.warn('[workspaceHelpers] Error uploading logo, continuing without logo:', logoError);
      // Don't fail workspace creation if logo upload fails
    }
  }

  return workspace as Workspace;
}

/**
 * Update workspace name (owner only)
 */
export async function updateWorkspaceName(
  workspaceId: string,
  name: string
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  const { error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', workspaceId);

  if (error) {
    console.error('[workspaceHelpers] Error updating workspace name:', error);
    throw error;
  }
}

/**
 * Upload workspace logo (owner only)
 */
export async function uploadWorkspaceLogo(
  workspaceId: string,
  file: File,
  userId: string
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only PNG, JPEG, and WebP are allowed.');
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('File size exceeds 5MB limit.');
  }

  // Generate unique filename
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${workspaceId}-${Date.now()}.${fileExt}`;
  const filePath = `workspaces/${workspaceId}/logo/${fileName}`;

  // Upload to workspace_logos bucket
  const { error: uploadError } = await supabase.storage
    .from('workspace_logos')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[workspaceHelpers] Error uploading logo:', uploadError);
    throw uploadError;
  }

  // Update workspace logo_path
  const { error: updateError } = await supabase
    .from('workspaces')
    .update({
      logo_path: filePath,
      logo_updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);

  if (updateError) {
    console.error('[workspaceHelpers] Error updating workspace logo_path:', updateError);
    // Try to delete uploaded file
    await supabase.storage.from('workspace_logos').remove([filePath]);
    throw updateError;
  }

  return filePath;
}

/**
 * Remove workspace logo (owner only)
 */
export async function removeWorkspaceLogo(workspaceId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  // Get current logo path
  const { data: workspace, error: fetchError } = await supabase
    .from('workspaces')
    .select('logo_path')
    .eq('id', workspaceId)
    .single();

  if (fetchError) {
    console.error('[workspaceHelpers] Error fetching workspace:', fetchError);
    throw fetchError;
  }

  // Delete logo from storage if exists
  if (workspace?.logo_path) {
    const { error: deleteError } = await supabase.storage
      .from('workspace_logos')
      .remove([workspace.logo_path]);

    if (deleteError) {
      console.warn('[workspaceHelpers] Error deleting logo file:', deleteError);
      // Continue even if file deletion fails
    }
  }

  // Update workspace to remove logo_path
  const { error: updateError } = await supabase
    .from('workspaces')
    .update({
      logo_path: null,
      logo_updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);

  if (updateError) {
    console.error('[workspaceHelpers] Error updating workspace:', updateError);
    throw updateError;
  }
}

/**
 * Add member to workspace (admin+ only)
 */
export async function addWorkspaceMember(
  workspaceId: string,
  userEmail: string,
  role: WorkspaceRole
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  // First, get user_id from email
  // Note: This requires the user to exist in auth.users
  // In a real implementation, you might want to use an invite system
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    // If admin API not available, we'll need to handle this differently
    // For now, throw an error - in production, use an invite system
    throw new Error('Cannot add members via email. Use invite system instead.');
  }

  const user = authUsers?.users.find((u) => u.email === userEmail);
  if (!user) {
    throw new Error(`User with email ${userEmail} not found`);
  }

  const { error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });

  if (error) {
    console.error('[workspaceHelpers] Error adding workspace member:', error);
    throw error;
  }
}

/**
 * Remove member from workspace (admin+ only)
 */
export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    console.error('[workspaceHelpers] Error removing workspace member:', error);
    throw error;
  }
}

/**
 * Update member role (admin+ only, owner can change all)
 */
export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  newRole: WorkspaceRole
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  const { error } = await supabase
    .from('workspace_members')
    .update({ role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    console.error('[workspaceHelpers] Error updating workspace member role:', error);
    throw error;
  }
}

/**
 * Get workspace logo URL
 */
export function getWorkspaceLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath || !supabase) {
    return null;
  }

  const { data } = supabase.storage
    .from('workspace_logos')
    .getPublicUrl(logoPath);

  return data.publicUrl;
}

/**
 * Generate initials from workspace name
 */
export function getWorkspaceInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}



