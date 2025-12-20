import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getUserWorkspaces } from './workspaceHelpers';

const ACTIVE_WORKSPACE_KEY = '@storystack:active_workspace_id';

/**
 * Get active workspace ID from localStorage/AsyncStorage (fast, client-side)
 */
export async function getActiveWorkspaceIdFromStorage(): Promise<string | null> {
  try {
    const workspaceId = await AsyncStorage.getItem(ACTIVE_WORKSPACE_KEY);
    return workspaceId;
  } catch (error) {
    console.error('[getActiveWorkspace] Error reading from storage:', error);
    return null;
  }
}

/**
 * Get active workspace ID from database (syncs across devices)
 */
export async function getActiveWorkspaceIdFromDatabase(
  userId: string
): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('active_workspace_id')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences record exists
        return null;
      }
      console.error('[getActiveWorkspace] Error fetching from database:', error);
      return null;
    }

    return data?.active_workspace_id || null;
  } catch (error) {
    console.error('[getActiveWorkspace] Error fetching from database:', error);
    return null;
  }
}

/**
 * Get active workspace ID (checks both storage and database, prefers database)
 */
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
  // Try database first (source of truth)
  const dbWorkspaceId = await getActiveWorkspaceIdFromDatabase(userId);
  if (dbWorkspaceId) {
    // Sync to local storage
    await setActiveWorkspaceIdToStorage(dbWorkspaceId);
    return dbWorkspaceId;
  }

  // Fall back to local storage
  const storageWorkspaceId = await getActiveWorkspaceIdFromStorage();
  if (storageWorkspaceId) {
    // Sync to database
    await setActiveWorkspaceIdToDatabase(userId, storageWorkspaceId);
    return storageWorkspaceId;
  }

  return null;
}

/**
 * Set active workspace ID in localStorage/AsyncStorage
 */
export async function setActiveWorkspaceIdToStorage(
  workspaceId: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  } catch (error) {
    console.error('[getActiveWorkspace] Error writing to storage:', error);
  }
}

/**
 * Set active workspace ID in database
 */
export async function setActiveWorkspaceIdToDatabase(
  userId: string,
  workspaceId: string
): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    // Upsert user preferences
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        active_workspace_id: workspaceId,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[getActiveWorkspace] Error updating database:', error);
      throw error;
    }
  } catch (error) {
    console.error('[getActiveWorkspace] Error updating database:', error);
    throw error;
  }
}

/**
 * Set active workspace ID (saves to both storage and database)
 */
export async function setActiveWorkspaceId(
  userId: string,
  workspaceId: string
): Promise<void> {
  // Save to both locations
  await Promise.all([
    setActiveWorkspaceIdToStorage(workspaceId),
    setActiveWorkspaceIdToDatabase(userId, workspaceId),
  ]);
}

/**
 * Get or create default workspace for user
 * If user has no active workspace, returns their first workspace or creates one
 */
export async function getOrCreateDefaultWorkspace(
  userId: string
): Promise<string> {
  // Check if user has an active workspace
  const activeWorkspaceId = await getActiveWorkspaceId(userId);
  if (activeWorkspaceId) {
    return activeWorkspaceId;
  }

  // Get user's workspaces
  const workspaces = await getUserWorkspaces(userId);
  if (workspaces.length > 0) {
    // Prioritize workspace created by user (their own workspace)
    const ownWorkspace = workspaces.find((w) => w.created_by === userId);
    if (ownWorkspace) {
      await setActiveWorkspaceId(userId, ownWorkspace.id);
      return ownWorkspace.id;
    }
    // Fallback to first workspace if no own workspace found
    const firstWorkspaceId = workspaces[0].id;
    await setActiveWorkspaceId(userId, firstWorkspaceId);
    return firstWorkspaceId;
  }

  // Create default workspace
  const { createWorkspace } = await import('./workspaceHelpers');
  const workspace = await createWorkspace('My Workspace', userId);
  await setActiveWorkspaceId(userId, workspace.id);
  return workspace.id;
}



