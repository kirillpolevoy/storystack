'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, X, Settings, Mail, UserPlus, Trash2, Crown, Shield, Edit, Eye, Check, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteWorkspace } from '@/utils/workspaceHelpers'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MobileMenuButton } from '@/components/app/MobileMenuButton'

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
  email?: string
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
  const [hasChanges, setHasChanges] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
  })

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const prevWorkspaceIdRef = useRef<string | null>(null)
  const prevWorkspaceNameRef = useRef<string>('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('@storystack:active_workspace_id')
      setActiveWorkspaceId(stored)
    } catch (error) {
      console.error('[WorkspaceSettings] Error reading localStorage:', error)
      // Continue without active workspace ID
    }
  }, [])

  const { data: workspace, isLoading, error: workspaceError } = useQuery({
    queryKey: ['workspace', activeWorkspaceId],
    queryFn: async () => {
      if (!activeWorkspaceId) return null
      try {
        const { data, error } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', activeWorkspaceId)
          .single()

        if (error) {
          console.error('[WorkspaceSettings] Error fetching workspace:', error)
          throw error
        }
        return data as Workspace
      } catch (error) {
        console.error('[WorkspaceSettings] Workspace query failed:', error)
        throw error
      }
    },
    enabled: !!activeWorkspaceId,
    retry: false,
  })

  const { data: member } = useQuery({
    queryKey: ['workspace-member', activeWorkspaceId, user?.id],
    queryFn: async () => {
      if (!activeWorkspaceId || !user?.id) return null
      try {
        const { data, error } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .eq('user_id', user.id)
          .single()

        // If member not found (PGRST116), return null instead of throwing
        if (error) {
          if (error.code === 'PGRST116') {
            return null
          }
          console.error('[WorkspaceSettings] Error fetching member:', error)
          throw error
        }
        return data as WorkspaceMember
      } catch (error: any) {
        // Handle "not found" gracefully
        if (error?.code === 'PGRST116') {
          return null
        }
        console.error('[WorkspaceSettings] Member query failed:', error)
        throw error
      }
    },
    enabled: !!activeWorkspaceId && !!user?.id,
    retry: false,
  })

  // Update workspace name when workspace changes, but only if it's a different workspace or name actually changed
  useEffect(() => {
    const workspaceId = workspace?.id
    const workspaceNameValue = workspace?.name
    
    if (!workspaceId || !workspaceNameValue) return
    
    // Only update if workspace ID changed or workspace name actually changed
    const isNewWorkspace = prevWorkspaceIdRef.current !== workspaceId
    const isNameChanged = prevWorkspaceNameRef.current !== workspaceNameValue
    
    if (isNewWorkspace || isNameChanged) {
      setWorkspaceName(workspaceNameValue)
      setHasChanges(false)
      prevWorkspaceIdRef.current = workspaceId
      prevWorkspaceNameRef.current = workspaceNameValue
    }
  }, [workspace?.id, workspace?.name])

  // Update hasChanges flag when workspaceName changes (only if workspace is loaded)
  useEffect(() => {
    if (!workspace?.name) return
    
    const hasChangesValue = workspaceName.trim() !== workspace.name && workspaceName.trim() !== ''
    setHasChanges(hasChangesValue)
  }, [workspaceName, workspace?.name])

  const hasRole = (minRole: 'owner' | 'admin' | 'editor' | 'viewer') => {
    if (!member) return false
    const roleHierarchy = { owner: 4, admin: 3, editor: 2, viewer: 1 }
    return roleHierarchy[member.role] >= roleHierarchy[minRole]
  }

  const handleSaveName = async () => {
    if (!workspace || !hasRole('owner')) {
      return
    }
    
    if (!workspace?.id || workspaceName.trim() === '' || workspaceName === workspace?.name) {
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ name: workspaceName.trim(), updated_at: new Date().toISOString() })
        .eq('id', workspace.id)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['workspace', activeWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['workspaces', user?.id] })
      setHasChanges(false)
    } catch (error: any) {
      console.error('Error updating workspace name:', error)
      alert(`Failed to update workspace name: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Helper functions
  const getWorkspaceInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const getWorkspaceLogoUrl = (logoPath: string | null | undefined) => {
    if (!logoPath) return null
    try {
      const { data } = supabase.storage.from('workspace_logos').getPublicUrl(logoPath)
      return data?.publicUrl || null
    } catch (error) {
      console.error('[WorkspaceSettings] Error getting logo URL:', error)
      return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading workspace settings...</p>
        </div>
      </div>
    )
  }

  if (!activeWorkspaceId) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-2 font-medium">No workspace selected</p>
          <p className="text-sm text-muted-foreground mb-4">
            Please select a workspace from the dropdown to view its settings.
          </p>
          <Button variant="outline" onClick={() => router.push('/app/library')}>
            Go to Library
          </Button>
        </div>
      </div>
    )
  }

  if (workspaceError) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-2 font-medium">Error loading workspace</p>
          <p className="text-sm text-muted-foreground mb-4">
            {workspaceError instanceof Error ? workspaceError.message : 'Unknown error occurred'}
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">No workspace found</p>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <MobileMenuButton />
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                  Workspace Settings
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage your workspace and team members</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <div className="space-y-8">
            {/* Workspace Name Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">Workspace name</h2>
                <p className="text-sm text-gray-600 mt-1.5">Change how this workspace appears to your team</p>
              </div>
              <div className="px-8 py-6">
                <div className="max-w-lg space-y-4">
                  <Input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Enter workspace name"
                    disabled={!member || !hasRole('owner')}
                    className="h-12 text-base border-gray-300 focus:border-accent focus:ring-accent rounded-lg"
                  />
                  {member && hasRole('owner') ? (
                    <div className="flex items-center gap-4">
                      <Button
                        onClick={handleSaveName}
                        disabled={!hasChanges || isSaving}
                        className="h-11 px-6 text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Save changes
                          </>
                        )}
                      </Button>
                      {hasChanges && (
                        <span className="text-sm text-gray-500">You have unsaved changes</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <Shield className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600">Only workspace owners can change the workspace name</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Team Members Section */}
            {workspace?.id && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <WorkspaceMembersSection 
                  workspaceId={workspace.id} 
                  currentUserId={user?.id}
                  hasAdminRole={member ? hasRole('admin') : false}
                  hasOwnerRole={member ? hasRole('owner') : false}
                />
              </div>
            )}

            {/* Delete Workspace Section */}
            {member && hasRole('owner') && (
              <div className="bg-white rounded-2xl border-2 border-red-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-red-50 bg-red-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-red-100">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-red-900">Delete workspace</h2>
                      <p className="text-sm text-red-700 mt-1">This action cannot be undone</p>
                    </div>
                  </div>
                </div>
                <div className="px-8 py-6">
                  <p className="text-base text-gray-700 mb-6 leading-relaxed">
                    Once you delete <span className="font-semibold text-gray-900">{workspace?.name || 'this workspace'}</span>, all of its data will be permanently removed. This includes all assets, stories, team members, and settings.
                  </p>
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    className="h-11 px-6 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm hover:shadow transition-all"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete workspace
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Workspace Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{workspace?.name}&quot;? This action cannot be undone.
              All workspace data, including assets, stories, and members, will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!workspace?.id) return
                setIsDeleting(true)
                try {
                  await deleteWorkspace(workspace.id)
                  // Invalidate workspace queries to refresh the dropdown
                  queryClient.invalidateQueries({ queryKey: ['workspaces'] })
                  queryClient.invalidateQueries({ queryKey: ['workspaces', user?.id] })
                  queryClient.invalidateQueries({ queryKey: ['workspace'] })
                  // Switch to first available workspace or redirect
                  const { data: workspaces } = await supabase
                    .from('workspace_members')
                    .select('workspace_id')
                    .eq('user_id', user?.id)
                    .limit(1)
                  
                  if (workspaces && workspaces.length > 0) {
                    localStorage.setItem('@storystack:active_workspace_id', workspaces[0].workspace_id)
                    router.push('/app/library')
                  } else {
                    router.push('/app/library')
                  }
                } catch (error: any) {
                  console.error('[WorkspaceSettings] Error deleting workspace:', error)
                  alert(error.message || 'Failed to delete workspace')
                } finally {
                  setIsDeleting(false)
                  setShowDeleteDialog(false)
                }
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Workspace'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

function WorkspaceMembersSection({ 
  workspaceId, 
  currentUserId,
  hasAdminRole,
  hasOwnerRole 
}: {
  workspaceId: string
  currentUserId?: string
  hasAdminRole: boolean
  hasOwnerRole: boolean
}) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null)
  const [memberToEditRole, setMemberToEditRole] = useState<WorkspaceMember | null>(null)
  const [newRole, setNewRole] = useState<'admin' | 'editor' | 'viewer'>('editor')

  const { data: members = [], isLoading, error: membersError } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      
      try {
        const { data, error } = await supabase.rpc('get_workspace_members_with_emails', {
          workspace_id_param: workspaceId,
        })

        if (error) {
          console.error('[WorkspaceMembers] RPC error:', error)
          // Fallback to direct query
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('workspace_members')
            .select('workspace_id, user_id, role, created_at')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: true })
          
          if (fallbackError) {
            console.error('[WorkspaceMembers] Fallback query error:', fallbackError)
            return [] // Return empty array instead of throwing
          }
        
          return (fallbackData || []).map((m: any) => ({
            workspace_id: m.workspace_id,
            user_id: m.user_id,
            role: m.role,
            created_at: m.created_at,
            email: undefined,
          })) as WorkspaceMember[]
        }

        if (!data || data.length === 0) return []
        
        return data.map((m: any) => ({
          workspace_id: m.workspace_id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: m.email && m.email !== 'Unknown' && m.email !== 'No email' ? m.email : undefined,
        })) as WorkspaceMember[]
      } catch (error) {
        console.error('[WorkspaceMembers] Query error:', error)
        return [] // Return empty array on any error
      }
    },
    enabled: !!workspaceId && hasAdminRole,
  })

  const { data: invitations = [] } = useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as WorkspaceInvitation[]
    },
    enabled: hasAdminRole && !!workspaceId,
  })

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) return

    setIsAddingMember(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Authentication error')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Invalid session')

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) throw new Error('Supabase URL not configured')

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
      if (!response.ok) throw new Error(result.error || result.message || 'Failed to add member')

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] }),
      ])
      
      setShowAddDialog(false)
      setNewMemberEmail('')
      
      if (result.invitation) {
        alert('Invitation sent successfully!')
      } else if (result.member) {
        alert('Member added successfully!')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to add member')
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleRemoveMember = async (member: WorkspaceMember) => {
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
      alert('Failed to remove member')
    }
  }

  const handleUpdateRole = async () => {
    if (!memberToEditRole) return

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
      alert('Failed to update role')
    }
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      owner: { icon: Crown, label: 'Owner', className: 'bg-amber-100 text-amber-800' },
      admin: { icon: Shield, label: 'Admin', className: 'bg-blue-100 text-blue-800' },
      editor: { icon: Edit, label: 'Editor', className: 'bg-purple-100 text-purple-800' },
      viewer: { icon: Eye, label: 'Viewer', className: 'bg-gray-100 text-gray-800' },
    }
    const badge = badges[role as keyof typeof badges] || badges.viewer
    const Icon = badge.icon
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium ${badge.className}`}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </span>
    )
  }

  const getInitials = (email?: string, userId?: string) => {
    const str = email || userId || ''
    return str.charAt(0).toUpperCase()
  }

  const getAvatarColor = (email?: string, userId?: string) => {
    const str = email || userId || ''
    const colors = [
      'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
      'bg-cyan-500', 'bg-teal-500', 'bg-green-500', 'bg-amber-500',
      'bg-orange-500', 'bg-red-500', 'bg-rose-500'
    ]
    const index = str.charCodeAt(0) % colors.length
    return colors[index]
  }

  if (!hasAdminRole) {
    return (
      <div>
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-500 mt-1">View workspace members</p>
        </div>
        <div className="px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No members found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(member.email, member.user_id)} flex items-center justify-center text-white font-semibold flex-shrink-0`}>
                    {getInitials(member.email, member.user_id)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.email || `User ${member.user_id.substring(0, 8)}...`}
                      </p>
                      {member.user_id === currentUserId && (
                        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">You</span>
                      )}
                    </div>
                    <div>{getRoleBadge(member.role)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Shield className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">Only workspace admins can manage team members</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Team members</h2>
            <p className="text-sm text-gray-600 mt-1.5">Manage who has access to this workspace</p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="h-11 px-5 text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add member
          </Button>
        </div>
      </div>
      <div className="px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        ) : members.length === 0 && invitations.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <UserPlus className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">No members yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add your first team member to get started</p>
            <Button
              onClick={() => setShowAddDialog(true)}
              size="sm"
            >
              Add member
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId
              const canEdit = hasAdminRole && (member.role !== 'owner' || hasOwnerRole)
              const canRemove = hasAdminRole && !isCurrentUser && (member.role !== 'owner' || hasOwnerRole)

              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 group border border-transparent hover:border-gray-100"
                >
                  <div className={`w-12 h-12 rounded-full ${getAvatarColor(member.email, member.user_id)} flex items-center justify-center text-white font-semibold text-base flex-shrink-0 shadow-sm`}>
                    {getInitials(member.email, member.user_id)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <p className="text-base font-medium text-gray-900 truncate">
                        {member.email || `User ${member.user_id.substring(0, 8)}...`}
                      </p>
                      {isCurrentUser && (
                        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">You</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getRoleBadge(member.role)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setMemberToEditRole(member)
                          setNewRole(member.role === 'owner' ? 'admin' : member.role as 'admin' | 'editor' | 'viewer')
                        }}
                        className="h-9 w-9 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMemberToRemove(member)}
                        className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200"
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {invitation.email}
                    </p>
                    <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full font-medium">
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleBadge(invitation.role)}
                    <span className="text-xs text-muted-foreground">
                      • Invited {new Date(invitation.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
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
                        alert('Failed to cancel invitation')
                      }
                    }
                  }}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Invite someone to join this workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Email address
              </label>
              <Input
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="colleague@example.com"
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Role
              </label>
              <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer - Can view content</SelectItem>
                  <SelectItem value="editor">Editor - Can edit content</SelectItem>
                  <SelectItem value="admin">Admin - Can manage workspace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground bg-gray-50 p-3 rounded-lg">
              The user must already have a StoryStack account. If they don't have an account, they'll receive an invitation to sign up.
            </p>
          </div>
          <div className="flex gap-3 mt-6">
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
              {isAddingMember ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add member'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.email || `User ${memberToRemove?.user_id.substring(0, 8)}...`} will lose access to all workspace data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      <Dialog open={!!memberToEditRole} onOpenChange={() => setMemberToEditRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              {memberToEditRole?.email || `User ${memberToEditRole?.user_id.substring(0, 8)}...`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                New role
              </label>
              <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {memberToEditRole?.role !== 'owner' && (
                    <>
                      <SelectItem value="viewer">Viewer - Can view content</SelectItem>
                      <SelectItem value="editor">Editor - Can edit content</SelectItem>
                      <SelectItem value="admin">Admin - Can manage workspace</SelectItem>
                    </>
                  )}
                  {memberToEditRole?.role === 'owner' && hasOwnerRole && (
                    <SelectItem value="admin">Admin - Can manage workspace</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setMemberToEditRole(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={newRole === memberToEditRole?.role}
              className="flex-1"
            >
              Update role
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
