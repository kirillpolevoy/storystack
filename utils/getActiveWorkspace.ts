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
 * Database is always the source of truth - if database has a value, use it even if storage differs
 */
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
  // Try database first (source of truth)
  const dbWorkspaceId = await getActiveWorkspaceIdFromDatabase(userId);
  if (dbWorkspaceId) {
    // Always sync database value to local storage (database wins)
    await setActiveWorkspaceIdToStorage(dbWorkspaceId);
    return dbWorkspaceId;
  }

  // Only fall back to local storage if database has no value
  // But verify the storage value is valid before using it
  const storageWorkspaceId = await getActiveWorkspaceIdFromStorage();
  if (storageWorkspaceId) {
    // Verify user is actually a member of this workspace before syncing to database
    // This prevents wrong workspace IDs from being synced
    const { getUserWorkspaces } = await import('./workspaceHelpers');
    try {
      const userWorkspaces = await getUserWorkspaces(userId);
      const isValidWorkspace = userWorkspaces.some((w) => w.id === storageWorkspaceId);
      
      if (isValidWorkspace) {
        // Only sync to database if it's a valid workspace the user belongs to
        await setActiveWorkspaceIdToDatabase(userId, storageWorkspaceId);
        return storageWorkspaceId;
      } else {
        // Invalid workspace in storage - clear it
        await setActiveWorkspaceIdToStorage('');
        await setActiveWorkspaceIdToDatabase(userId, null); // Use null, not empty string
        return null;
      }
    } catch (error) {
      console.error('[getActiveWorkspace] Error validating storage workspace:', error);
      // On error, clear invalid storage and return null
      await setActiveWorkspaceIdToStorage('');
      await setActiveWorkspaceIdToDatabase(userId, null); // Use null, not empty string
      return null;
    }
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
  workspaceId: string | null
): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    // Convert empty string to null (database expects UUID or NULL, not empty string)
    const workspaceIdValue = workspaceId === '' ? null : workspaceId;
    
    // Upsert user preferences
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        active_workspace_id: workspaceIdValue,
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
  workspaceId: string | null
): Promise<void> {
  // Convert null to empty string for storage (storage can handle empty strings)
  const storageValue = workspaceId || '';
  
  // Save to both locations
  await Promise.all([
    setActiveWorkspaceIdToStorage(storageValue),
    setActiveWorkspaceIdToDatabase(userId, workspaceId), // Database gets null, not empty string
  ]);
}

/**
 * Get or create default workspace for user
 * If user has no active workspace, returns their first workspace or creates one
 * Always prioritizes workspace created by user (their own workspace)
 *
 * NOTE: For new signups, the workspace is created by a database trigger on auth.users INSERT.
 * However, RLS policies may not immediately recognize the new user's session.
 * We retry a few times to handle this timing issue.
 */
export async function getOrCreateDefaultWorkspace(
  userId: string
): Promise<string> {
  // Check if user has an active workspace
  const activeWorkspaceId = await getActiveWorkspaceId(userId);

  // If we have an active workspace, validate it's still valid
  if (activeWorkspaceId) {
    const workspaces = await getUserWorkspaces(userId);
    const isValidWorkspace = workspaces.some((w) => w.id === activeWorkspaceId);

    if (isValidWorkspace) {
      // Valid workspace - but ensure it's the user's own workspace if they have one
      const ownWorkspace = workspaces.find((w) => w.created_by === userId);
      if (ownWorkspace && ownWorkspace.id !== activeWorkspaceId) {
        // User has their own workspace but active workspace is different - fix it
        console.log('[getActiveWorkspace] Fixing active workspace: user has own workspace but active is different');
        await setActiveWorkspaceId(userId, ownWorkspace.id);
        return ownWorkspace.id;
      }
      return activeWorkspaceId;
    } else {
      // Invalid workspace - clear it and continue to find/create default
      console.log('[getActiveWorkspace] Active workspace is invalid, clearing it');
      await setActiveWorkspaceIdToStorage('');
      await setActiveWorkspaceIdToDatabase(userId, null); // Use null, not empty string
    }
  }

  // Get user's workspaces with retry logic
  // New users may not immediately see their workspace due to RLS timing after email confirmation
  let workspaces: Awaited<ReturnType<typeof getUserWorkspaces>> = [];
  const maxRetries = 5;
  const retryDelays = [500, 1000, 2000, 3000, 5000]; // Progressive delays

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    workspaces = await getUserWorkspaces(userId);

    if (workspaces.length > 0) {
      console.log(`[getActiveWorkspace] Found ${workspaces.length} workspaces on attempt ${attempt + 1}`);
      break;
    }

    if (attempt < maxRetries - 1) {
      console.log(`[getActiveWorkspace] No workspaces found, retrying in ${retryDelays[attempt]}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }
  }

  if (workspaces.length > 0) {
    // ALWAYS prioritize workspace created by user (their own workspace)
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

  // Create default workspace only if retries exhausted and still no workspace
  // This shouldn't normally happen since the database trigger should create one
  console.log('[getActiveWorkspace] No workspaces found after retries, creating default workspace');
  const { createWorkspace } = await import('./workspaceHelpers');
  const workspace = await createWorkspace('My Workspace', userId);
  await setActiveWorkspaceId(userId, workspace.id);
  return workspace.id;
}



