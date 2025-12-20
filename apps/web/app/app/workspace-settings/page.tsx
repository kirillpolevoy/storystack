'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Upload, X, Settings, Mail, UserPlus, Trash2, Crown, Shield, Edit, Eye } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Workspace {
  id: string
  name: string
  logo_path?: string | null
  logo_updated_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
  status: string
}

interface WorkspaceMember {
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  created_at: string
}

interface WorkspaceInvitation {
  id: string
  workspace_id: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'pending' | 'accepted' | 'expired'
  created_at: string
  expires_at: string | null
}

export default function WorkspaceSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [workspaceName, setWorkspaceName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
  })

  // Get active workspace ID from localStorage
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('@storystack:active_workspace_id')
    setActiveWorkspaceId(stored)
  }, [])

  // Fetch workspace data
  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspace', activeWorkspaceId],
    queryFn: async () => {
      if (!activeWorkspaceId) return null
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', activeWorkspaceId)
        .single()

      if (error) throw error
      return data as Workspace
    },
    enabled: !!activeWorkspaceId,
  })

  // Fetch user role
  const { data: member } = useQuery({
    queryKey: ['workspace-member', activeWorkspaceId, user?.id],
    queryFn: async () => {
      if (!activeWorkspaceId || !user?.id) return null
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      return data as WorkspaceMember
    },
    enabled: !!activeWorkspaceId && !!user?.id,
  })

  useEffect(() => {
    if (workspace) {
      setWorkspaceName(workspace.name)
      if (workspace.logo_path) {
        const { data } = supabase.storage.from('workspace_logos').getPublicUrl(workspace.logo_path)
        setLogoPreview(data.publicUrl)
      } else {
        setLogoPreview(null)
      }
    }
  }, [workspace, supabase])

  const hasRole = (minRole: 'owner' | 'admin' | 'editor' | 'viewer') => {
    if (!member) return false
    const roleHierarchy = { owner: 4, admin: 3, editor: 2, viewer: 1 }
    return roleHierarchy[member.role] >= roleHierarchy[minRole]
  }

  const handleSaveName = async () => {
    if (!workspace) {
      alert('No workspace selected.')
      return
    }
    
    // Debug: Check role before proceeding
    console.log('[WorkspaceSettings] Attempting to save name:', {
      workspaceId: workspace.id,
      currentRole: member?.role,
      hasOwnerRole: hasRole('owner'),
      userId: user?.id
    })
    
    if (!hasRole('owner')) {
      alert('Only workspace owners can rename the workspace.')
      console.error('[WorkspaceSettings] User does not have owner role. Current role:', member?.role)
      return
    }
    
    if (workspaceName.trim() === '' || workspaceName === workspace.name) {
      return
    }

    setIsSaving(true)
    try {
      console.log('[WorkspaceSettings] Updating workspace name:', {
        workspaceId: workspace.id,
        oldName: workspace.name,
        newName: workspaceName.trim(),
        userRole: member?.role,
        userId: user?.id
      })

      const { data, error } = await supabase
        .from('workspaces')
        .update({ name: workspaceName.trim(), updated_at: new Date().toISOString() })
        .eq('id', workspace.id)
        .select()

      if (error) {
        console.error('[WorkspaceSettings] Update error:', error)
        console.error('[WorkspaceSettings] Error code:', error.code)
        console.error('[WorkspaceSettings] Error message:', error.message)
        console.error('[WorkspaceSettings] Error details:', error.details)
        console.error('[WorkspaceSettings] Error hint:', error.hint)
        
        // More specific error messages
        if (error.code === '42501') {
          throw new Error('Permission denied. You may not have owner role in this workspace.')
        } else if (error.code === 'PGRST301') {
          throw new Error('Row-level security policy violation. Check your workspace membership.')
        } else {
          throw error
        }
      }

      console.log('[WorkspaceSettings] Update successful:', data)
      queryClient.invalidateQueries({ queryKey: ['workspace', activeWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['workspace-member', activeWorkspaceId, user?.id] })
      alert('Workspace name updated successfully.')
    } catch (error: any) {
      console.error('[WorkspaceSettings] Error updating workspace name:', error)
      const errorMessage = error?.message || error?.details || error?.hint || 'Unknown error occurred'
      alert(`Failed to update workspace name: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspace || !hasRole('owner')) {
      alert('Only workspace owners can upload a logo.')
      return
    }

    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      alert('Please upload a PNG, JPG, or WebP image.')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.')
      return
    }

    setIsUploadingLogo(true)
    try {
      const fileExt = file.name.split('.').pop() || 'png'
      const fileName = `${workspace.id}.${fileExt}`
      const filePath = `workspaces/${workspace.id}/logo/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('workspace_logos')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Update workspace table
      const { error: dbError } = await supabase
        .from('workspaces')
        .update({ logo_path: filePath, logo_updated_at: new Date().toISOString() })
        .eq('id', workspace.id)

      if (dbError) throw dbError

      queryClient.invalidateQueries({ queryKey: ['workspace', activeWorkspaceId] })
      const { data } = supabase.storage.from('workspace_logos').getPublicUrl(filePath)
      setLogoPreview(data.publicUrl)
      alert('Workspace logo updated successfully.')
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo.')
    } finally {
      setIsUploadingLogo(false)
      e.target.value = '' // Reset input
    }
  }

  const handleRemoveLogo = async () => {
    if (!workspace || !hasRole('owner')) {
      alert('Only workspace owners can remove the logo.')
      return
    }
    if (!workspace.logo_path) {
      alert('There is no logo to remove.')
      return
    }

    if (!confirm('Are you sure you want to remove the workspace logo?')) {
      return
    }

    setIsUploadingLogo(true)
    try {
      // Remove from storage
      const { error: storageError } = await supabase.storage
        .from('workspace_logos')
        .remove([workspace.logo_path])

      if (storageError) {
        console.error('Error removing logo from storage:', storageError)
        // Continue with DB update
      }

      // Update workspace table
      const { error: dbError } = await supabase
        .from('workspaces')
        .update({ logo_path: null, logo_updated_at: new Date().toISOString() })
        .eq('id', workspace.id)

      if (dbError) throw dbError

      queryClient.invalidateQueries({ queryKey: ['workspace', activeWorkspaceId] })
      setLogoPreview(null)
      alert('Workspace logo removed successfully.')
    } catch (error) {
      console.error('Error removing logo:', error)
      alert('Failed to remove logo.')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading workspace settings...</div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">No workspace found. Please select a workspace.</div>
      </div>
    )
  }

  const initials = workspace.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-gray-600" />
            <h1 className="text-xl font-semibold text-gray-900">Workspace Settings</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Workspace Name */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Workspace Name</h2>
            <div className="space-y-4">
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
                disabled={!hasRole('owner')}
                className="max-w-md"
              />
              {hasRole('owner') ? (
                <Button
                  onClick={handleSaveName}
                  disabled={isSaving || workspaceName.trim() === '' || workspaceName === workspace.name}
                >
                  {isSaving ? 'Saving...' : 'Save Name'}
                </Button>
              ) : (
                <p className="text-sm text-gray-500">Only the workspace owner can change the name.</p>
              )}
            </div>
          </div>

          {/* Workspace Logo */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Workspace Logo</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt={workspace.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-2xl font-semibold text-gray-600">{initials}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Current Logo</p>
                </div>
              </div>
              {hasRole('owner') ? (
                <div className="flex gap-2">
                  <label>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploadingLogo}
                      className="cursor-pointer"
                      asChild
                    >
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload New Logo
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleUploadLogo}
                      className="hidden"
                    />
                  </label>
                  {workspace.logo_path && (
                    <Button
                      variant="outline"
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? 'Processing...' : 'Remove Logo'}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Only the workspace owner can manage the logo.</p>
              )}
            </div>
          </div>

          {/* Workspace Members */}
          <WorkspaceMembersSection 
            workspaceId={workspace.id} 
            currentUserId={user?.id}
            hasAdminRole={hasRole('admin')}
            hasOwnerRole={hasRole('owner')}
          />
        </div>
      </div>
    </div>
  )
}

interface WorkspaceMembersSectionProps {
  workspaceId: string
  currentUserId?: string
  hasAdminRole: boolean
  hasOwnerRole: boolean
}

function WorkspaceMembersSection({ 
  workspaceId, 
  currentUserId,
  hasAdminRole,
  hasOwnerRole 
}: WorkspaceMembersSectionProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null)
  const [memberToEditRole, setMemberToEditRole] = useState<WorkspaceMember | null>(null)
  const [newRole, setNewRole] = useState<'admin' | 'editor' | 'viewer'>('editor')

  // Fetch workspace members with user emails
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      console.log('[WorkspaceMembers] Fetching members for workspace:', workspaceId)
      
      // Use the database function to get members with emails
      const { data, error } = await supabase.rpc('get_workspace_members_with_emails', {
        workspace_id_param: workspaceId,
      })

      if (error) {
        console.error('[WorkspaceMembers] Error fetching members:', error)
        // Fallback: try direct query without emails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('workspace_members')
          .select('workspace_id, user_id, role, created_at')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true })
        
        if (fallbackError) throw fallbackError
        
        return (fallbackData || []).map((m: any) => ({
          ...m,
          email: `User ${m.user_id.substring(0, 8)}...`,
        })) as (WorkspaceMember & { email: string })[]
      }

      console.log('[WorkspaceMembers] Members with emails:', data)
      
      return (data || []) as (WorkspaceMember & { email: string })[]
    },
  })

  // Fetch pending invitations
  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: async () => {
      console.log('[WorkspaceMembers] Fetching invitations for workspace:', workspaceId)
      const { data, error } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[WorkspaceMembers] Error fetching invitations:', error)
        throw error
      }
      
      console.log('[WorkspaceMembers] Fetched invitations:', data)
      return (data || []) as WorkspaceInvitation[]
    },
    enabled: hasAdminRole && !!workspaceId, // Only fetch if user has admin role and workspaceId exists
  })

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      alert('Please enter an email address')
      return
    }

    setIsAddingMember(true)
    try {
      // Get current user - this will refresh the session if needed
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('[AddMember] Error getting user:', userError)
        throw new Error('Authentication error. Please sign in again.')
      }
      
      if (!user) {
        console.error('[AddMember] No user found')
        // Redirect to login - the middleware will handle this
        window.location.href = '/login'
        return
      }

      // Get session - getUser() above should have refreshed it if needed
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('[AddMember] Error getting session:', sessionError)
        throw new Error('Session error. Please sign in again.')
      }
      
      if (!session) {
        console.error('[AddMember] No session found')
        // Redirect to login - the middleware will handle this
        window.location.href = '/login'
        return
      }

      if (!session.access_token) {
        console.error('[AddMember] No access token in session')
        throw new Error('Invalid session. Please sign in again.')
      }

      // Get Supabase URL from environment (NEXT_PUBLIC_ vars are available in browser)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please check your environment variables.')
      }

      console.log('[AddMember] Calling edge function:', {
        url: `${supabaseUrl}/functions/v1/add-workspace-member`,
        workspaceId,
        email: newMemberEmail.trim(),
        role: newRole,
        hasToken: !!session.access_token,
      })

      // Call edge function to add member
      const response = await fetch(`${supabaseUrl}/functions/v1/add-workspace-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          email: newMemberEmail.trim(),
          role: newRole,
        }),
      })

      const result = await response.json()
      
      console.log('[AddMember] Edge function response:', {
        status: response.status,
        ok: response.ok,
        result,
      })

      if (!response.ok) {
        console.error('[AddMember] Edge function error:', {
          status: response.status,
          result,
        })
        throw new Error(result.error || result.message || 'Failed to add member')
      }

      // Refresh members list and invitations
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] }),
      ])
      
      setShowAddDialog(false)
      setNewMemberEmail('')
      
      // Show appropriate message based on whether it was an invitation or direct add
      if (result.invitation) {
        console.log('[AddMember] Invitation created:', result.invitation)
        alert('Invitation sent successfully! The user will be added to the workspace when they sign up.')
      } else if (result.member) {
        console.log('[AddMember] Member added:', result.member)
        alert('Member added successfully!')
      } else if (result.success) {
        // Generic success message
        console.log('[AddMember] Success response:', result)
        alert(result.message || 'Success! Please refresh the page to see the changes.')
      } else {
        console.warn('[AddMember] Unexpected response format:', result)
        alert('Success, but unexpected response format. Please refresh the page.')
      }
    } catch (error: any) {
      console.error('[AddMember] Error adding member:', error)
      const errorMessage = error.message || 'Failed to add member. Make sure the user has signed up first.'
      alert(errorMessage)
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (member.role === 'owner' && !hasOwnerRole) {
      alert('Only the workspace owner can remove the owner')
      return
    }

    if (member.user_id === currentUserId) {
      alert('You cannot remove yourself from the workspace')
      return
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', member.user_id)

      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] })
      setMemberToRemove(null)
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Failed to remove member')
    }
  }

  const handleUpdateRole = async () => {
    if (!memberToEditRole) return

    if (memberToEditRole.role === 'owner' && !hasOwnerRole) {
      alert('Only the workspace owner can change the owner role')
      return
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('workspace_id', workspaceId)
        .eq('user_id', memberToEditRole.user_id)

      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] })
      setMemberToEditRole(null)
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update role')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      case 'editor':
        return <Edit className="h-4 w-4 text-gray-600" />
      case 'viewer':
        return <Eye className="h-4 w-4 text-gray-500" />
      default:
        return null
    }
  }

  const getRoleLabel = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  if (!hasAdminRole) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Workspace Members</h2>
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-sm text-gray-500">Loading members...</div>
          ) : (
            members.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-600">
                      {(member as any).email?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {(member as any).email || 'Unknown'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      {getRoleIcon(member.role)}
                      <span>{getRoleLabel(member.role)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Only workspace admins can manage members.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Workspace Members</h2>
        <Button
          onClick={() => setShowAddDialog(true)}
          size="sm"
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading || isLoadingInvitations ? (
          <div className="text-sm text-gray-500">Loading members...</div>
        ) : members.length === 0 && invitations.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">No members found.</div>
        ) : (
          <>
            {/* Display actual members */}
            {members.map((member) => {
            const isCurrentUser = member.user_id === currentUserId
            const canEdit = hasAdminRole && (member.role !== 'owner' || hasOwnerRole)
            const canRemove = hasAdminRole && !isCurrentUser && (member.role !== 'owner' || hasOwnerRole)

            return (
              <div
                key={member.user_id}
                className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-600">
                      {(member as any).email?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {(member as any).email || 'Unknown'}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs text-gray-500">(You)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      {getRoleIcon(member.role)}
                      <span>{getRoleLabel(member.role)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMemberToEditRole(member)
                        setNewRole(member.role === 'owner' ? 'admin' : member.role as 'admin' | 'editor' | 'viewer')
                      }}
                      className="h-7 px-2"
                    >
                      Change Role
                    </Button>
                  )}
                  {canRemove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMemberToRemove(member)}
                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          
          {/* Display pending invitations */}
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-yellow-50 border border-yellow-200"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-full bg-yellow-200 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {invitation.email}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {getRoleIcon(invitation.role)}
                    <span>{getRoleLabel(invitation.role)}</span>
                    <span className="text-gray-400">•</span>
                    <span>Invited {new Date(invitation.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (confirm(`Cancel invitation for ${invitation.email}?`)) {
                      try {
                        const { error } = await supabase
                          .from('workspace_invitations')
                          .delete()
                          .eq('id', invitation.id)
                        
                        if (error) throw error
                        queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] })
                      } catch (error) {
                        console.error('Error canceling invitation:', error)
                        alert('Failed to cancel invitation')
                      }
                    }
                  }}
                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          </>
        )}
      </div>

      {/* Add Member Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Member</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Role
                </label>
                <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                The user must already have a StoryStack account. Enter their email address to add them to this workspace.
              </p>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false)
                  setNewMemberEmail('')
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMember}
                disabled={isAddingMember || !newMemberEmail.trim()}
                className="flex-1"
              >
                {isAddingMember ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {(memberToRemove as any)?.email} from this workspace? They will lose access to all workspace data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      {memberToEditRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Change Role</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Member: {(memberToEditRole as any).email}
                </label>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  New Role
                </label>
                <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {memberToEditRole.role !== 'owner' && (
                      <>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </>
                    )}
                    {memberToEditRole.role === 'owner' && hasOwnerRole && (
                      <SelectItem value="admin">Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setMemberToEditRole(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateRole}
                disabled={newRole === memberToEditRole.role}
                className="flex-1"
              >
                Update Role
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

