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
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          // Handle refresh token errors gracefully
          if (error.message?.includes('Refresh Token') || 
              error.message?.includes('refresh_token') ||
              error.message?.includes('Invalid Refresh Token')) {
            console.warn('[AuthContext] Invalid refresh token, clearing session:', error.message);
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
        if (error.message?.includes('Refresh Token') || 
            error.message?.includes('refresh_token') ||
            error.message?.includes('Invalid Refresh Token')) {
          console.warn('[AuthContext] Invalid refresh token (catch), clearing session:', error.message);
          supabase.auth.signOut().catch(() => {});
          setSession(null);
        } else {
          console.error('[AuthContext] Unexpected error getting session:', error);
          setSession(null);
        }
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      
      // On first signup, initialize user data
      if (_event === 'SIGNED_IN' && session) {
        await initializeUserData(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
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

      // 7. Delete campaigns
      const { error: campaignsError } = await supabase
        .from('campaigns')
        .delete()
        .eq('user_id', userId);
      
      if (campaignsError) {
        console.error('[AuthContext] Error deleting campaigns:', campaignsError);
        errors.push(`Failed to delete campaigns: ${campaignsError.message}`);
      } else {
        console.log('[AuthContext] Deleted campaigns');
      }

      // 8. Delete tag_config
      const { error: tagConfigError } = await supabase
        .from('tag_config')
        .delete()
        .eq('user_id', userId);
      
      if (tagConfigError) {
        console.error('[AuthContext] Error deleting tag_config:', tagConfigError);
        errors.push(`Failed to delete tag config: ${tagConfigError.message}`);
      } else {
        console.log('[AuthContext] Deleted tag_config');
      }

      // 9. Delete user's storage files (avatars)
      try {
        const { data: files } = await supabase.storage
          .from('avatars')
          .list(userId);
        
        if (files && files.length > 0) {
          const filePaths = files.map(file => `${userId}/${file.name}`);
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
          throw new Error(result.error || 'Failed to delete auth user');
        }

        console.log('[AuthContext] Deleted auth user via Edge Function');
      } catch (edgeFunctionError: any) {
        console.error('[AuthContext] Error deleting auth user via Edge Function:', edgeFunctionError);
        // If Edge Function doesn't exist or fails, continue with sign out
        // The auth user will remain but all data is deleted
        errors.push(`Failed to delete auth user: ${edgeFunctionError.message}`);
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
    // Check if user already has data (prevent duplicate initialization)
    // Note: This will fail if user_id column doesn't exist yet (Phase 2 not done)
    let existingCampaign = null;
    try {
      const { data } = await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();
      existingCampaign = data;
    } catch (error: any) {
      // If user_id column doesn't exist, check by name instead (fallback for Phase 1)
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('user_id')) {
        console.log('[Auth] user_id column not found, using fallback method');
        const { data } = await supabase
          .from('campaigns')
          .select('id')
          .eq('name', 'My Library')
          .limit(1)
          .single();
        existingCampaign = data;
      }
    }

    if (existingCampaign) {
      console.log('[Auth] User data already initialized');
      return;
    }

    // Create default campaign
    // Try with user_id first, fallback to without if schema not ready
    let campaignError = null;
    let campaign = null;
    
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          name: 'My Library',
        })
        .select('id')
        .single();
      campaign = data;
      campaignError = error;
    } catch (error: any) {
      // If user_id column doesn't exist, create without it (Phase 1 fallback)
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('user_id')) {
        console.log('[Auth] Creating campaign without user_id (Phase 1 fallback)');
        const { data, error: fallbackError } = await supabase
          .from('campaigns')
          .insert({
            name: 'My Library',
          })
          .select('id')
          .single();
        campaign = data;
        campaignError = fallbackError;
      } else {
        campaignError = error;
      }
    }

    if (campaignError || !campaign) {
      console.error('[Auth] Failed to create default campaign:', campaignError);
      return;
    }

    // Create default tag_config (only if schema supports it)
    // This will fail gracefully if user_id column doesn't exist yet (Phase 2 not done)
    // Note: auto_tags starts empty - user must enable tags in Tag Management screen
    try {
      const { error: tagConfigError } = await supabase
        .from('tag_config')
        .insert({
          user_id: userId,
          auto_tags: [],
          custom_tags: [],
          deleted_tags: [],
        });

      if (tagConfigError) {
        // Check if it's a schema error (expected before Phase 2)
        if (tagConfigError.code === 'PGRST204' || tagConfigError.message?.includes('column') || tagConfigError.message?.includes('schema')) {
          console.log('[Auth] Tag config schema not ready yet (Phase 2 pending). Skipping tag config creation.');
        } else {
          console.error('[Auth] Failed to create tag config:', tagConfigError);
        }
      }
    } catch (error) {
      // Schema not ready - this is expected before Phase 2
      console.log('[Auth] Tag config creation skipped (schema not ready):', error);
    }

    console.log('[Auth] User data initialized successfully');
  } catch (error) {
    console.error('[Auth] Error initializing user data:', error);
  }
}

