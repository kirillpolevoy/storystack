import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client to delete the user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // First, delete all storage objects owned by the user
    // Supabase Auth requires all storage objects to be deleted before user deletion
    console.log('[delete-user] Deleting all storage objects for user:', user.id);
    
    // List of buckets to check and clean
    const bucketsToCheck = ['avatars', 'assets', 'workspace_logos'];
    
    for (const bucketName of bucketsToCheck) {
      try {
        // List all files in the bucket (with service role, we can see everything)
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(bucketName)
          .list('', {
            limit: 1000,
            offset: 0,
            sortBy: { column: 'created_at', order: 'asc' }
          });
        
        if (listError) {
          console.warn(`[delete-user] Error listing files in ${bucketName}:`, listError);
          continue;
        }
        
        if (files && files.length > 0) {
          // Filter files that belong to this user
          // For avatars: path is userId/filename
          // For assets: path is workspaces/{workspace_id}/assets/{asset_id}/...
          // For workspace_logos: path is workspaces/{workspace_id}/logo/...
          const userFiles = files.filter(file => {
            const path = file.name;
            // Check if path starts with user.id (for avatars) or contains user references
            return path.startsWith(`${user.id}/`) || 
                   path.includes(`/${user.id}/`) ||
                   path.startsWith(`users/${user.id}/`);
          });
          
          if (userFiles.length > 0) {
            const filePaths = userFiles.map(file => file.name);
            console.log(`[delete-user] Found ${filePaths.length} files in ${bucketName} to delete`);
            
            const { error: deleteError } = await supabaseAdmin.storage
              .from(bucketName)
              .remove(filePaths);
            
            if (deleteError) {
              console.warn(`[delete-user] Error deleting files from ${bucketName}:`, deleteError);
            } else {
              console.log(`[delete-user] Deleted ${filePaths.length} files from ${bucketName}`);
            }
          }
        }
      } catch (bucketError) {
        console.warn(`[delete-user] Error processing bucket ${bucketName}:`, bucketError);
      }
    }
    
    // CRITICAL: Delete storage objects directly from storage.objects table using RPC
    // Supabase Auth checks this table directly, not through the Storage API
    console.log('[delete-user] Deleting storage objects via RPC function');
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('delete_user_storage_objects', {
        user_id_param: user.id
      });
      
      if (rpcError) {
        console.warn('[delete-user] RPC delete_user_storage_objects error:', rpcError);
        // Continue anyway - storage cleanup via API might be sufficient
      } else {
        console.log('[delete-user] Successfully deleted storage objects via RPC');
      }
    } catch (rpcException) {
      console.warn('[delete-user] Exception calling delete_user_storage_objects:', rpcException);
      // Continue anyway
    }
    
    // Delete campaigns owned by the user before deleting the user
    // This prevents foreign key constraint violations
    console.log('[delete-user] Deleting campaigns for user:', user.id);
    try {
      const { error: campaignsDeleteError } = await supabaseAdmin
        .from('campaigns')
        .delete()
        .eq('user_id', user.id);
      
      if (campaignsDeleteError) {
        console.warn('[delete-user] Error deleting campaigns:', campaignsDeleteError);
        // Continue anyway - might not have campaigns or table might not exist
      } else {
        console.log('[delete-user] Successfully deleted campaigns');
      }
    } catch (campaignsError) {
      console.warn('[delete-user] Exception deleting campaigns:', campaignsError);
      // Continue anyway - campaigns table might not exist or might be handled by CASCADE
    }
    
    // Small delay to ensure storage deletions are committed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Comprehensive diagnosis before deletion
    console.log('[delete-user] Running comprehensive diagnostics...');
    
    // Check for blocking constraints
    try {
      const { data: constraints, error: constraintError } = await supabaseAdmin
        .rpc('find_all_user_references', { target_user_id: user.id });
      
      if (!constraintError && constraints && constraints.length > 0) {
        const restrictConstraints = constraints.filter((c: any) => 
          c.delete_action === 'RESTRICT' || c.delete_action === 'DEFAULT (RESTRICT)'
        );
        if (restrictConstraints.length > 0) {
          console.error('[delete-user] ⚠️  Found RESTRICT constraints:', JSON.stringify(restrictConstraints, null, 2));
        } else {
          console.log('[delete-user] ✅ No RESTRICT constraints found');
        }
      }
    } catch (diagError) {
      console.warn('[delete-user] Could not check constraints:', diagError);
    }
    
    // Check for storage objects
    try {
      const { data: storageObjects, error: storageError } = await supabaseAdmin
        .rpc('check_user_storage_objects', { target_user_id: user.id });
      
      if (!storageError && storageObjects && storageObjects.length > 0) {
        const totalObjects = storageObjects.reduce((sum: number, obj: any) => sum + Number(obj.object_count || 0), 0);
        if (totalObjects > 0) {
          console.warn('[delete-user] ⚠️  Found storage objects:', JSON.stringify(storageObjects, null, 2));
        } else {
          console.log('[delete-user] ✅ No storage objects found');
        }
      } else {
        console.log('[delete-user] ✅ No storage objects found');
      }
    } catch (storageDiagError) {
      console.warn('[delete-user] Could not check storage:', storageDiagError);
    }
    
    // Check for active sessions
    try {
      const { data: sessions, error: sessionError } = await supabaseAdmin
        .rpc('check_user_sessions', { target_user_id: user.id });
      
      if (!sessionError && sessions && sessions.length > 0) {
        const sessionData = sessions[0];
        if (sessionData && Number(sessionData.active_session_count || 0) > 0) {
          console.warn('[delete-user] ⚠️  User has active sessions:', JSON.stringify(sessionData, null, 2));
          // Try to revoke all sessions
          const { error: revokeError } = await supabaseAdmin.auth.admin.signOut(user.id, 'global');
          if (revokeError) {
            console.warn('[delete-user] Could not revoke sessions:', revokeError);
          } else {
            console.log('[delete-user] ✅ Revoked all user sessions');
          }
        }
      }
    } catch (sessionDiagError) {
      console.warn('[delete-user] Could not check sessions:', sessionDiagError);
    }
    
    // Try to get the actual database error OR delete directly if test succeeds
    let userAlreadyDeleted = false;
    try {
      const { data: testResult, error: testError } = await supabaseAdmin
        .rpc('test_user_deletion', { target_user_id: user.id });
      
      if (!testError && testResult) {
        if (testResult.includes('ERROR:')) {
          console.error('[delete-user] 🔴 Actual database error:', testResult);
          // Extract the actual error message
          const actualError = testResult.replace('ERROR: ', '');
          return new Response(
            JSON.stringify({ 
              error: `Database error: ${actualError}`,
              details: { actualDatabaseError: actualError },
              code: 'DATABASE_ERROR'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (testResult.includes('SUCCESS')) {
          console.log('[delete-user] ✅ User deleted successfully via direct SQL');
          userAlreadyDeleted = true;
          // User was deleted by test_user_deletion, return success
          return new Response(
            JSON.stringify({ success: true, message: 'User deleted successfully (via direct SQL)' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (testDiagError) {
      console.warn('[delete-user] Could not test deletion:', testDiagError);
    }
    
    // If user was already deleted, don't try again
    if (userAlreadyDeleted) {
      return new Response(
        JSON.stringify({ success: true, message: 'User already deleted' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[delete-user] Attempting to delete user via Auth API:', user.id);
    
    // Delete the user using admin API
    try {
      const { data: deleteData, error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

      if (deleteError) {
        // If user not found, that's actually success (user was already deleted)
        if (deleteError.code === 'user_not_found' || deleteError.status === 404) {
          console.log('[delete-user] ✅ User not found (already deleted)');
          return new Response(
            JSON.stringify({ success: true, message: 'User already deleted' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Capture all possible error properties
        const errorDetails: any = {
          message: deleteError.message,
          status: deleteError.status,
          code: deleteError.code,
          name: deleteError.name,
        };
        
        // Try to serialize the full error object
        try {
          errorDetails.fullError = JSON.stringify(deleteError, Object.getOwnPropertyNames(deleteError));
        } catch (e) {
          errorDetails.fullError = String(deleteError);
        }
        
        // Try to get error context if available
        if ((deleteError as any).context) {
          errorDetails.context = (deleteError as any).context;
        }
        
        console.error('[delete-user] Error deleting user:', deleteError);
        console.error('[delete-user] Error details:', JSON.stringify(errorDetails, null, 2));
        console.error('[delete-user] User ID:', user.id);
        
        // Return more detailed error information
        return new Response(
          JSON.stringify({ 
            error: deleteError.message || 'Database error deleting user',
            details: errorDetails,
            code: deleteError.status || deleteError.code || 'UNKNOWN'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[delete-user] Successfully deleted user:', user.id);
      console.log('[delete-user] Delete response data:', deleteData);
    } catch (deleteException: any) {
      // Catch any exceptions during deletion
      console.error('[delete-user] Exception during user deletion:', deleteException);
      console.error('[delete-user] Exception details:', JSON.stringify(deleteException, null, 2));
      
      return new Response(
        JSON.stringify({ 
          error: deleteException.message || 'Exception during user deletion',
          details: {
            message: deleteException.message,
            name: deleteException.name,
            stack: deleteException.stack,
            fullError: String(deleteException)
          },
          code: 'EXCEPTION'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

