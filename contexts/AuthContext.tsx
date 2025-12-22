import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  deleteAccount: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session with error handling for invalid refresh tokens
    if (!supabase) {
      console.warn('[AuthContext] Supabase client not available');
      setLoading(false);
      return;
    }
    
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          // Handle refresh token errors gracefully
          const errorMessage = error.message || '';
          const errorName = (error as any)?.name || '';
          const errorCode = (error as any)?.status || (error as any)?.code || '';
          
          // More comprehensive refresh token error detection
          const isRefreshTokenError = 
            errorName === 'AuthApiError' ||
            errorMessage.includes('Refresh Token') || 
            errorMessage.includes('refresh_token') ||
            errorMessage.includes('Invalid Refresh Token') ||
            errorMessage.includes('refresh token not found') ||
            errorMessage.includes('Refresh Token Not Found') ||
            errorMessage.toLowerCase().includes('refresh') && errorMessage.toLowerCase().includes('token') ||
            (errorName === 'AuthApiError' && (errorMessage.toLowerCase().includes('refresh') || errorMessage.toLowerCase().includes('token'))) ||
            errorCode === 401; // 401 Unauthorized often indicates token issues
            
          if (isRefreshTokenError) {
            console.warn('[AuthContext] Invalid refresh token, clearing session:', { errorMessage, errorName, errorCode });
            // Clear invalid session from storage and let user sign in again
            supabase.auth.signOut().catch(() => {
              // Ignore errors during sign out
            });
            setSession(null);
          } else {
            console.error('[AuthContext] Error getting session:', error);
            setSession(null);
          }
        } else {
          setSession(session);
        }
        setLoading(false);
      })
      .catch((error) => {
        // Handle AuthApiError specifically
        const errorMessage = error?.message || '';
        const errorName = error?.name || '';
        const errorCode = error?.status || error?.code || '';
        
        // More comprehensive refresh token error detection
        const isRefreshTokenError = 
          errorName === 'AuthApiError' ||
          errorMessage.includes('Refresh Token') || 
          errorMessage.includes('refresh_token') ||
          errorMessage.includes('Invalid Refresh Token') ||
          errorMessage.includes('refresh token not found') ||
          errorMessage.includes('Refresh Token Not Found') ||
          errorMessage.toLowerCase().includes('refresh') && errorMessage.toLowerCase().includes('token') ||
          (errorName === 'AuthApiError' && (errorMessage.toLowerCase().includes('refresh') || errorMessage.toLowerCase().includes('token'))) ||
          errorCode === 401;
          
        if (isRefreshTokenError) {
          console.warn('[AuthContext] Invalid refresh token (catch), clearing session:', { errorMessage, errorName, errorCode });
          supabase.auth.signOut().catch(() => {});
          setSession(null);
        } else {
          console.error('[AuthContext] Unexpected error getting session:', error);
          setSession(null);
        }
        setLoading(false);
      });

    // Listen for auth changes
    if (!supabase) {
      setLoading(false);
      return;
    }
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        // Handle SIGNED_OUT event (can occur when refresh token is invalid)
        if (_event === 'SIGNED_OUT') {
          console.log('[AuthContext] User signed out');
          setSession(null);
          setLoading(false);
          return;
        }
        
        // Handle refresh token errors that might occur during automatic refresh
        if (_event === 'TOKEN_REFRESHED' && !session) {
          console.warn('[AuthContext] Token refresh failed - clearing session');
          // Clear invalid session
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
            // Ignore sign out errors
          }
          setSession(null);
          setLoading(false);
          return;
        }
        
        // Handle TOKEN_REFRESHED event with error
        if (_event === 'TOKEN_REFRESHED') {
          // If session is null after refresh, it means refresh failed
          if (!session) {
            console.warn('[AuthContext] Token refresh resulted in null session - clearing');
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              // Ignore sign out errors
            }
            setSession(null);
            setLoading(false);
            return;
          }
        }
        
        setSession(session);
        
        // On first signup, initialize user data
        if (_event === 'SIGNED_IN' && session) {
          await initializeUserData(session.user.id);
        }
        
        setLoading(false);
      } catch (error: any) {
        // Catch any errors during auth state change (including refresh token errors)
        const errorMessage = error?.message || '';
        const errorName = error?.name || '';
        const errorCode = error?.status || error?.code || '';
        
        // More comprehensive refresh token error detection
        const isRefreshTokenError = 
          errorName === 'AuthApiError' ||
          errorMessage.includes('Refresh Token') || 
          errorMessage.includes('refresh_token') ||
          errorMessage.includes('Invalid Refresh Token') ||
          errorMessage.includes('refresh token not found') ||
          errorMessage.includes('Refresh Token Not Found') ||
          errorMessage.toLowerCase().includes('refresh') && errorMessage.toLowerCase().includes('token') ||
          (errorName === 'AuthApiError' && (errorMessage.toLowerCase().includes('refresh') || errorMessage.toLowerCase().includes('token'))) ||
          errorCode === 401;
          
        if (isRefreshTokenError) {
          console.warn('[AuthContext] Refresh token error in auth state change:', { errorMessage, errorName, errorCode });
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
            // Ignore sign out errors
          }
          setSession(null);
        } else {
          console.error('[AuthContext] Error in auth state change:', error);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase client not available' }, data: null };
    }
    // For mobile: Use deep link directly
    // Supabase will handle the redirect properly if configured
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Don't set emailRedirectTo - let Supabase use default behavior
        // Then handle the callback in the app
      },
    });
    return { error, data };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase client not available' } };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const deleteAccount = async () => {
    if (!session?.user?.id) {
      return { error: { message: 'No user session found' } };
    }

    const userId = session.user.id;
    const errors: string[] = [];

    try {
      console.log('[AuthContext] Starting account deletion for user:', userId);

      // Delete user data in order (respecting foreign key constraints)
      // Note: RLS policies should allow users to delete their own data
      
      // 1. Get all story IDs for this user
      const { data: userStories, error: storiesFetchError } = await supabase
        .from('stories')
        .select('id')
        .eq('user_id', userId);

      if (storiesFetchError) {
        console.error('[AuthContext] Error fetching stories:', storiesFetchError);
        errors.push(`Failed to fetch stories: ${storiesFetchError.message}`);
      }

      // 2. Delete story_assets for all user's stories
      if (userStories && userStories.length > 0) {
        const storyIds = userStories.map(s => s.id);
        const { error: storyAssetsError } = await supabase
          .from('story_assets')
          .delete()
          .in('story_id', storyIds);
        
        if (storyAssetsError) {
          console.error('[AuthContext] Error deleting story_assets:', storyAssetsError);
          errors.push(`Failed to delete story assets: ${storyAssetsError.message}`);
        } else {
          console.log('[AuthContext] Deleted story_assets for', storyIds.length, 'stories');
        }
      }

      // 3. Delete stories
      const { error: storiesError } = await supabase
        .from('stories')
        .delete()
        .eq('user_id', userId);
      
      if (storiesError) {
        console.error('[AuthContext] Error deleting stories:', storiesError);
        errors.push(`Failed to delete stories: ${storiesError.message}`);
      } else {
        console.log('[AuthContext] Deleted stories');
      }

      // 4. Get all asset IDs before deletion (for storage cleanup)
      const { data: userAssets } = await supabase
        .from('assets')
        .select('id, storage_path')
        .eq('user_id', userId);

      // 5. Delete assets (this will cascade delete story_assets references if any remain)
      const { error: assetsError } = await supabase
        .from('assets')
        .delete()
        .eq('user_id', userId);
      
      if (assetsError) {
        console.error('[AuthContext] Error deleting assets:', assetsError);
        errors.push(`Failed to delete assets: ${assetsError.message}`);
      } else {
        console.log('[AuthContext] Deleted assets');
      }

      // 6. Delete asset storage files
      if (userAssets && userAssets.length > 0) {
        try {
          const storagePaths = userAssets
            .map(asset => asset.storage_path)
            .filter(path => path); // Filter out null/undefined paths
          
          if (storagePaths.length > 0) {
            const { error: storageError } = await supabase.storage
              .from('assets')
              .remove(storagePaths);
            
            if (storageError) {
              console.warn('[AuthContext] Error deleting asset storage files:', storageError);
              errors.push(`Failed to delete some asset files: ${storageError.message}`);
            } else {
              console.log('[AuthContext] Deleted', storagePaths.length, 'asset storage files');
            }
          }
        } catch (storageError: any) {
          console.warn('[AuthContext] Error deleting asset storage files:', storageError);
          errors.push(`Failed to delete asset files: ${storageError.message}`);
        }
      }

      // 7. Get workspaces where user is owner (to delete them)
      const { data: ownedWorkspaces } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .eq('role', 'owner');
      
      const ownedWorkspaceIds = ownedWorkspaces?.map(w => w.workspace_id) || [];
      
      // Delete workspace memberships (this will cascade delete workspaces if user is only member)
      const { error: membersError } = await supabase
        .from('workspace_members')
        .delete()
        .eq('user_id', userId);
      
      if (membersError) {
        console.error('[AuthContext] Error deleting workspace memberships:', membersError);
        errors.push(`Failed to delete workspace memberships: ${membersError.message}`);
      } else {
        console.log('[AuthContext] Deleted workspace memberships');
      }
      
      // Delete workspaces where user was owner (if any remain after cascade)
      if (ownedWorkspaceIds.length > 0) {
        // Get workspace logo paths before deletion
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id, logo_path')
          .in('id', ownedWorkspaceIds);
        
        // Delete workspace logos from storage
        if (workspaces) {
          const logoPaths = workspaces
            .map(w => w.logo_path)
            .filter(path => path);
          
          if (logoPaths.length > 0) {
            const { error: logoError } = await supabase.storage
              .from('workspace_logos')
              .remove(logoPaths);
            
            if (logoError) {
              console.warn('[AuthContext] Error deleting workspace logos:', logoError);
            } else {
              console.log('[AuthContext] Deleted workspace logos');
            }
          }
        }
        
        // Delete workspaces (cascade should handle most, but delete explicitly)
        const { error: workspacesError } = await supabase
          .from('workspaces')
          .delete()
          .in('id', ownedWorkspaceIds);
        
        if (workspacesError) {
          console.error('[AuthContext] Error deleting workspaces:', workspacesError);
          errors.push(`Failed to delete workspaces: ${workspacesError.message}`);
        } else {
          console.log('[AuthContext] Deleted workspaces');
        }
      }

      // 8. Delete tag_config (workspace-scoped, will be deleted with workspace cascade)
      // But also delete any orphaned tag_configs
      const { error: tagConfigError } = await supabase
        .from('tag_config')
        .delete()
        .in('workspace_id', ownedWorkspaceIds);
      
      if (tagConfigError) {
        console.error('[AuthContext] Error deleting tag_config:', tagConfigError);
        errors.push(`Failed to delete tag config: ${tagConfigError.message}`);
      } else {
        console.log('[AuthContext] Deleted tag_config');
      }
      
      // 9. Delete user preferences
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', userId);
      
      if (prefsError) {
        console.warn('[AuthContext] Error deleting user preferences:', prefsError);
      } else {
        console.log('[AuthContext] Deleted user preferences');
      }

      // 10. Delete user's storage files from all buckets
      // Delete from avatars bucket
      try {
        const { data: avatarFiles } = await supabase.storage
          .from('avatars')
          .list(userId);
        
        if (avatarFiles && avatarFiles.length > 0) {
          const filePaths = avatarFiles.map(file => `${userId}/${file.name}`);
          const { error: avatarError } = await supabase.storage
            .from('avatars')
            .remove(filePaths);
          
          if (avatarError) {
            console.warn('[AuthContext] Error deleting avatar files:', avatarError);
            errors.push(`Failed to delete avatar files: ${avatarError.message}`);
          } else {
            console.log('[AuthContext] Deleted avatar files');
          }
        }
      } catch (storageError: any) {
        console.warn('[AuthContext] Error deleting avatar storage files:', storageError);
        errors.push(`Failed to delete avatar files: ${storageError.message}`);
      }

      // Delete from workspace_logos bucket (if user owns any workspace logos)
      try {
        // Get all workspaces created by this user
        const { data: userWorkspaces } = await supabase
          .from('workspaces')
          .select('id, logo_path')
          .eq('created_by', userId);
        
        if (userWorkspaces && userWorkspaces.length > 0) {
          const logoPaths = userWorkspaces
            .map(w => w.logo_path)
            .filter((path): path is string => !!path);
          
          if (logoPaths.length > 0) {
            const { error: logoError } = await supabase.storage
              .from('workspace_logos')
              .remove(logoPaths);
            
            if (logoError) {
              console.warn('[AuthContext] Error deleting workspace logo files:', logoError);
              // Don't add to errors - workspace logos might be shared or already deleted
            } else {
              console.log('[AuthContext] Deleted workspace logo files');
            }
          }
        }
      } catch (logoError: any) {
        console.warn('[AuthContext] Error deleting workspace logo files:', logoError);
        // Don't add to errors - this is non-critical
      }

      // Check if we had critical errors
      // Non-critical errors (like storage file deletion) are acceptable
      const criticalErrors = errors.filter(e => 
        !e.includes('storage') && 
        !e.includes('avatar') && 
        !e.includes('asset files')
      );

      if (criticalErrors.length > 0) {
        console.error('[AuthContext] Account deletion failed with critical errors:', criticalErrors);
        return { 
          error: { 
            message: `Failed to delete account: ${criticalErrors.join('; ')}` 
          } 
        };
      }

      // 10. Delete the auth user via Edge Function
      // This requires the delete-user Edge Function to be deployed
      try {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase configuration not found');
        }

        // Get the current session token
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.access_token) {
          throw new Error('No active session');
        }

        // Call the Edge Function to delete the auth user
        // Edge Functions require both Authorization (user token) and apikey (anon key) headers
        const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('[AuthContext] Edge function error response:', {
            status: response.status,
            statusText: response.statusText,
            result: result,
            errorDetails: result.details,
            errorCode: result.code,
            fullError: result.details?.fullError,
          });
          
          // Log the full error details if available
          if (result.details) {
            console.error('[AuthContext] Error details:', JSON.stringify(result.details, null, 2));
          }
          
          const errorMessage = result.error || `Failed to delete auth user: ${response.status} ${response.statusText}`;
          throw new Error(errorMessage);
        }

        console.log('[AuthContext] Deleted auth user via Edge Function');
      } catch (edgeFunctionError: any) {
        console.error('[AuthContext] Error deleting auth user via Edge Function:', edgeFunctionError);
        console.error('[AuthContext] Error details:', JSON.stringify(edgeFunctionError, null, 2));
        // If Edge Function doesn't exist or fails, continue with sign out
        // The auth user will remain but all data is deleted
        const errorMessage = edgeFunctionError.message || 'Unknown error';
        errors.push(`Failed to delete auth user: ${errorMessage}`);
      }

      // Sign out after successful deletion (or if auth user deletion failed)
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('[AuthContext] Error signing out after deletion:', signOutError);
        return { 
          error: { 
            message: `Data deleted but failed to sign out: ${signOutError.message}` 
          } 
        };
      }

      if (errors.length > 0) {
        console.warn('[AuthContext] Account deletion completed with minor errors:', errors);
        // Still return success if only non-critical errors
      } else {
        console.log('[AuthContext] Account deletion completed successfully');
      }

      return { error: null };
    } catch (error: any) {
      console.error('[AuthContext] Error deleting account:', error);
      return { error: { message: error.message || 'Failed to delete account' } };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signUp,
        signIn,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Initialize user's default data on first signup
async function initializeUserData(userId: string) {
  if (!supabase) return;

  try {
    // Check if user already has a workspace (prevent duplicate initialization)
    let existingWorkspace = null;
    try {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .limit(1);
      
      if (members && members.length > 0) {
        existingWorkspace = members[0].workspace_id;
      }
    } catch (error: any) {
      // Schema might not be ready yet
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('relation')) {
        console.log('[Auth] Workspace schema not ready yet. Skipping workspace creation.');
        return;
      }
      console.error('[Auth] Error checking for existing workspace:', error);
    }

    if (existingWorkspace) {
      console.log('[Auth] User already has a workspace');
      return;
    }

    // Create default workspace
    let workspaceError = null;
    let workspace = null;
    
    try {
      // Get user email for workspace name
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || '';
      const workspaceName = userEmail 
        ? `${userEmail.split('@')[0]}'s Workspace`
        : 'My Workspace';
      
      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name: workspaceName,
          created_by: userId,
          status: 'active',
        })
        .select('id')
        .single();
      workspace = data;
      workspaceError = error;
    } catch (error: any) {
      workspaceError = error;
    }

    if (workspaceError || !workspace) {
      console.error('[Auth] Failed to create default workspace:', workspaceError);
      return;
    }

    // Add user as owner of the workspace
    try {
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          role: 'owner',
          created_by: userId,
        });

      if (memberError) {
        console.error('[Auth] Failed to add user as workspace owner:', memberError);
        // Clean up workspace if member creation fails
        await supabase.from('workspaces').delete().eq('id', workspace.id);
        return;
      }
    } catch (error) {
      console.error('[Auth] Error adding user as workspace owner:', error);
      // Clean up workspace
      await supabase.from('workspaces').delete().eq('id', workspace.id);
      return;
    }

    // Create default tag_config for workspace
    // Note: auto_tags starts empty - user must enable tags in Tag Management screen
    try {
      const { error: tagConfigError } = await supabase
        .from('tag_config')
        .insert({
          workspace_id: workspace.id,
          auto_tags: [],
          custom_tags: [],
          deleted_tags: [],
        });

      if (tagConfigError) {
        // Check if it's a schema error (expected before migration)
        if (tagConfigError.code === 'PGRST204' || tagConfigError.message?.includes('column') || tagConfigError.message?.includes('schema')) {
          console.log('[Auth] Tag config schema not ready yet. Skipping tag config creation.');
        } else {
          console.error('[Auth] Failed to create tag config:', tagConfigError);
        }
      }
    } catch (error) {
      // Schema not ready - this is expected before migration
      console.log('[Auth] Tag config creation skipped (schema not ready):', error);
    }

    // Set as active workspace in user preferences
    try {
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          active_workspace_id: workspace.id,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.warn('[Auth] Failed to set active workspace:', error);
      // Non-critical, continue
    }

    console.log('[Auth] User data initialized successfully with workspace:', workspace.id);
  } catch (error) {
    console.error('[Auth] Error initializing user data:', error);
  }
}

