import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  Workspace,
  WorkspaceRole,
  WorkspaceMember,
} from '@/types';
import {
  getUserWorkspaces,
  getWorkspaceRole,
  hasWorkspacePermission,
  createWorkspace,
} from '@/utils/workspaceHelpers';
import {
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  getOrCreateDefaultWorkspace,
} from '@/utils/getActiveWorkspace';

type WorkspaceContextType = {
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  userRole: WorkspaceRole | null;
  loading: boolean;
  error: string | null;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createNewWorkspace: (name: string, logoFile?: File) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
  hasPermission: (minRole: WorkspaceRole) => boolean;
  refreshUserRole: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextType>({
  activeWorkspace: null,
  activeWorkspaceId: null,
  workspaces: [],
  userRole: null,
  loading: true,
  error: null,
  switchWorkspace: async () => {},
  createNewWorkspace: async () => {
    throw new Error('WorkspaceContext not initialized');
  },
  refreshWorkspaces: async () => {},
  hasPermission: () => false,
  refreshUserRole: async () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userRole, setUserRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to access latest workspaces without causing dependency issues
  const workspacesRef = useRef<Workspace[]>([]);
  useEffect(() => {
    workspacesRef.current = workspaces;
  }, [workspaces]);

  // Load workspaces for the user
  const loadWorkspaces = useCallback(async () => {
    if (!user?.id) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    try {
      const userWorkspaces = await getUserWorkspaces(user.id);
      setWorkspaces(userWorkspaces);
      setError(null);
      return userWorkspaces; // Return workspaces for use in loadActiveWorkspace
    } catch (err) {
      console.error('[WorkspaceContext] Error loading workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      setWorkspaces([]);
      return [];
    }
  }, [user?.id]);

  // Force session refresh to ensure JWT is up-to-date
  // This is important after email confirmation where JWT might be stale
  const refreshSession = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn('[WorkspaceContext] Session refresh failed:', error);
      } else {
        console.log('[WorkspaceContext] Session refreshed successfully');
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Session refresh error:', err);
    }
  }, []);

  // Load active workspace
  const loadActiveWorkspace = useCallback(async () => {
    if (!user?.id) {
      setActiveWorkspaceIdState(null);
      setActiveWorkspace(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      // Get or create default workspace
      const workspaceId = await getOrCreateDefaultWorkspace(user.id);
      setActiveWorkspaceIdState(workspaceId);

      // Find workspace in current workspaces (use ref to avoid dependency)
      let workspace = workspacesRef.current.find((w) => w.id === workspaceId);
      
      if (!workspace) {
        // If not found, refresh workspaces and get the result
        const refreshedWorkspaces = await loadWorkspaces();
        workspace = refreshedWorkspaces.find((w) => w.id === workspaceId);
      }
      
      if (workspace) {
        setActiveWorkspace(workspace);
      }

      // Load user role
      if (workspaceId) {
        const role = await getWorkspaceRole(workspaceId, user.id);
        setUserRole(role);
      }

      setError(null);
    } catch (err) {
      console.error('[WorkspaceContext] Error loading active workspace:', err);
      setError(err instanceof Error ? err.message : 'Failed to load active workspace');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadWorkspaces]); // Removed workspaces from dependencies

  // Switch to a different workspace
  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      try {
        // Verify user is a member of this workspace
        const role = await getWorkspaceRole(workspaceId, user.id);
        if (!role) {
          throw new Error('You are not a member of this workspace');
        }

        // Set active workspace
        await setActiveWorkspaceId(user.id, workspaceId);
        setActiveWorkspaceIdState(workspaceId);

        // Update active workspace object (use ref to avoid dependency)
        let workspace = workspacesRef.current.find((w) => w.id === workspaceId);
        if (workspace) {
          setActiveWorkspace(workspace);
        } else {
          // Refresh workspaces if not found and get result
          const refreshedWorkspaces = await loadWorkspaces();
          workspace = refreshedWorkspaces.find((w) => w.id === workspaceId);
          if (workspace) {
            setActiveWorkspace(workspace);
          }
        }

        // Update user role
        setUserRole(role);
        setError(null);
      } catch (err) {
        console.error('[WorkspaceContext] Error switching workspace:', err);
        setError(err instanceof Error ? err.message : 'Failed to switch workspace');
        throw err;
      }
    },
    [user?.id, workspaces, loadWorkspaces]
  );

  // Create a new workspace
  const createNewWorkspace = useCallback(
    async (name: string, logoFile?: File): Promise<Workspace> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      try {
        const workspace = await createWorkspace(name, user.id, logoFile);
        
        // Refresh workspaces list
        await loadWorkspaces();
        
        // Switch to new workspace
        await switchWorkspace(workspace.id);
        
        setError(null);
        return workspace;
      } catch (err) {
        console.error('[WorkspaceContext] Error creating workspace:', err);
        setError(err instanceof Error ? err.message : 'Failed to create workspace');
        throw err;
      }
    },
    [user?.id, loadWorkspaces, switchWorkspace]
  );

  // Refresh workspaces list
  const refreshWorkspaces = useCallback(async () => {
    await loadWorkspaces();
    // Reload active workspace if needed (use ref to avoid dependency)
    if (activeWorkspaceId) {
      const workspace = workspacesRef.current.find((w) => w.id === activeWorkspaceId);
      if (workspace) {
        setActiveWorkspace(workspace);
      }
    }
  }, [loadWorkspaces, activeWorkspaceId]); // Removed workspaces from dependencies

  // Refresh user role
  const refreshUserRole = useCallback(async () => {
    if (!user?.id || !activeWorkspaceId) {
      setUserRole(null);
      return;
    }

    try {
      const role = await getWorkspaceRole(activeWorkspaceId, user.id);
      setUserRole(role);
    } catch (err) {
      console.error('[WorkspaceContext] Error refreshing user role:', err);
    }
  }, [user?.id, activeWorkspaceId]);

  // Check if user has permission
  const hasPermission = useCallback(
    (minRole: WorkspaceRole): boolean => {
      if (!userRole) {
        return false;
      }
      return hasWorkspacePermission(userRole, minRole);
    },
    [userRole]
  );

  // Initialize on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      // Refresh session first to ensure JWT is up-to-date
      // This is critical after email confirmation where the JWT might be stale
      refreshSession().then(() => {
        loadWorkspaces().then(() => {
          loadActiveWorkspace();
        });
      });
    } else {
      setActiveWorkspaceIdState(null);
      setActiveWorkspace(null);
      setWorkspaces([]);
      setUserRole(null);
      setLoading(false);
    }
  }, [user?.id, loadWorkspaces, loadActiveWorkspace, refreshSession]);

  // Update active workspace when workspaces list changes
  useEffect(() => {
    if (activeWorkspaceId && workspaces.length > 0) {
      const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
      if (workspace) {
        setActiveWorkspace(workspace);
      }
    }
  }, [activeWorkspaceId, workspaces]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      activeWorkspace,
      activeWorkspaceId,
      workspaces,
      userRole,
      loading,
      error,
      switchWorkspace,
      createNewWorkspace,
      refreshWorkspaces,
      hasPermission,
      refreshUserRole,
    }),
    [
      activeWorkspace,
      activeWorkspaceId,
      workspaces,
      userRole,
      loading,
      error,
      switchWorkspace,
      createNewWorkspace,
      refreshWorkspaces,
      hasPermission,
      refreshUserRole,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);



