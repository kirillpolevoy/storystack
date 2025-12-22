'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronDown, Settings, Plus, Check } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Workspace {
  id: string
  name: string
  logo_path?: string | null
  created_by?: string
}

interface WorkspaceSwitcherProps {
  isMinimized?: boolean
}

export function WorkspaceSwitcher({ isMinimized = false }: WorkspaceSwitcherProps) {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('@storystack:active_workspace_id')
    setActiveWorkspaceId(stored)
  }, [])

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
  })

  // Fetch user's workspaces
  const { data: workspaces = [], isLoading, error: workspacesError } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('[WorkspaceSwitcher] No user ID, returning empty array')
        return []
      }
      
      console.log('[WorkspaceSwitcher] Fetching workspaces for user:', user.id, user.email)
      
      // First, check if user is in workspace_members at all
      const { data: membersCheck, error: membersError } = await supabase
        .from('workspace_members')
        .select('workspace_id, user_id, role')
        .eq('user_id', user.id)
        .limit(5)
      
      console.log('[WorkspaceSwitcher] Raw workspace_members check:', {
        count: membersCheck?.length || 0,
        members: membersCheck,
        error: membersError,
      })
      
      if (membersError) {
        console.error('[WorkspaceSwitcher] Error checking workspace_members:', membersError)
      }
      
      // Now try the join query
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          workspaces (
            id,
            name,
            logo_path,
            created_by
          )
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('[WorkspaceSwitcher] Error fetching workspaces:', error)
        console.error('[WorkspaceSwitcher] Error details:', JSON.stringify(error, null, 2))
        throw error
      }
      
      console.log('[WorkspaceSwitcher] Fetched workspace members:', data)
      const workspacesList = (data || []).map((wm: any) => wm.workspaces).filter(Boolean) as Workspace[]
      console.log('[WorkspaceSwitcher] Mapped workspaces:', workspacesList)
      
      if (workspacesList.length === 0) {
        console.warn('[WorkspaceSwitcher] ⚠️ No workspaces found for user. User might not be in workspace_members table.')
      }
      
      return workspacesList
    },
    enabled: !!user?.id,
    retry: 1,
  })
  
  // Log error if query fails
  useEffect(() => {
    if (workspacesError) {
      console.error('[WorkspaceSwitcher] Workspaces query error:', workspacesError)
    }
  }, [workspacesError])

  // Get active workspace - prefer stored, fallback to user's own workspace, then first workspace
  const activeWorkspace = (() => {
    if (activeWorkspaceId) {
      const found = workspaces.find((w) => w.id === activeWorkspaceId)
      if (found) return found
    }
    // Fallback: prioritize user's own workspace
    if (user?.id) {
      const ownWorkspace = workspaces.find((w) => w.created_by === user.id)
      if (ownWorkspace) return ownWorkspace
    }
    return workspaces[0]
  })()

  // Auto-select workspace if none is set - prioritize user's own workspace
  useEffect(() => {
    if (workspaces.length === 0 || !user?.id) return
    
    // If no active workspace ID is set, prioritize user's own workspace
    if (!activeWorkspaceId) {
      // Find user's own workspace first
      const ownWorkspace = workspaces.find((w) => w.created_by === user.id)
      const workspaceToSelect = ownWorkspace || workspaces[0]
      
      if (workspaceToSelect) {
        console.log('[WorkspaceSwitcher] Auto-selecting workspace:', workspaceToSelect.id, ownWorkspace ? '(own)' : '(first available)')
        setActiveWorkspaceId(workspaceToSelect.id)
        localStorage.setItem('@storystack:active_workspace_id', workspaceToSelect.id)
        // Invalidate workspace-related queries only
        queryClient.invalidateQueries({ queryKey: ['workspace'] })
        queryClient.invalidateQueries({ queryKey: ['workspaces'] })
        queryClient.invalidateQueries({ queryKey: ['stories'] })
      }
      return
    }
    
    // Check if the active workspace ID is still valid
    const isValidWorkspace = workspaces.some((w) => w.id === activeWorkspaceId)
    if (!isValidWorkspace && workspaces.length > 0) {
      // Active workspace ID is invalid, prioritize user's own workspace
      const ownWorkspace = workspaces.find((w) => w.created_by === user.id)
      const workspaceToSelect = ownWorkspace || workspaces[0]
      
      console.log('[WorkspaceSwitcher] Active workspace invalid, switching to:', workspaceToSelect.id, ownWorkspace ? '(own)' : '(first available)')
      setActiveWorkspaceId(workspaceToSelect.id)
      localStorage.setItem('@storystack:active_workspace_id', workspaceToSelect.id)
      // Invalidate workspace-related queries only
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    }
  }, [workspaces, activeWorkspaceId, user?.id, queryClient])

  const { switchWorkspace: switchWorkspaceContext } = useWorkspace()

  const handleSwitchWorkspace = async (workspaceId: string) => {
    console.log('[WorkspaceSwitcher] Switching to workspace:', workspaceId)
    
    setIsOpen(false)
    
    // Use centralized workspace switch handler
    await switchWorkspaceContext(workspaceId)
    
    // Update local state for UI
    setActiveWorkspaceId(workspaceId)
  }

  const handleWorkspaceCreated = (workspaceId: string) => {
    // Refresh workspaces list
    queryClient.invalidateQueries({ queryKey: ['workspaces', user?.id] })
    // Switch to the new workspace
    handleSwitchWorkspace(workspaceId)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const getLogoUrl = (logoPath: string | null | undefined) => {
    if (!logoPath) return null
    const { data } = supabase.storage.from('workspace_logos').getPublicUrl(logoPath)
    return data.publicUrl
  }

  if (isLoading) {
    return (
      <div className="h-9 w-full bg-gray-100 rounded-md animate-pulse" />
    )
  }

  if (!activeWorkspace && workspaces.length === 0) {
    return (
      <div className="h-9 px-3 flex items-center justify-center text-xs text-gray-500 rounded-md border border-gray-200">
        No workspaces
      </div>
    )
  }

  if (!activeWorkspace) {
    return null
  }

  const logoUrl = getLogoUrl(activeWorkspace.logo_path)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={isMinimized 
            ? "h-9 w-9 p-0 justify-center" 
            : "h-9 px-3 gap-2 justify-between w-full"
          }
          title={isMinimized ? activeWorkspace.name : undefined}
        >
          {isMinimized ? (
            // Minimized: Show only icon
            logoUrl ? (
              <img
                src={logoUrl}
                alt={activeWorkspace.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-600">
                  {getInitials(activeWorkspace.name)}
                </span>
              </div>
            )
          ) : (
            // Expanded: Show icon, name, and chevron
            <>
              <div className="flex items-center gap-2 min-w-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={activeWorkspace.name}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-600">
                      {getInitials(activeWorkspace.name)}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900 truncate">
                  {activeWorkspace.name}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2">
          {workspaces.map((workspace) => {
            const wsLogoUrl = getLogoUrl(workspace.logo_path)
            const isActive = workspace.id === activeWorkspaceId
            return (
              <button
                key={workspace.id}
                onClick={() => handleSwitchWorkspace(workspace.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors ${
                  isActive ? 'bg-accent/10' : ''
                }`}
              >
                {wsLogoUrl ? (
                  <img
                    src={wsLogoUrl}
                    alt={workspace.name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-600">
                      {getInitials(workspace.name)}
                    </span>
                  </div>
                )}
                <span className="flex-1 text-sm font-medium text-gray-900 text-left">
                  {workspace.name}
                </span>
                {isActive && (
                  <Check className="h-4 w-4 text-accent flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
        <div className="border-t border-gray-200 p-2 space-y-1">
          <button
            onClick={() => {
              setIsOpen(false)
              setShowCreateDialog(true)
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-sm text-gray-700"
          >
            <Plus className="h-4 w-4" />
            <span>Create Workspace</span>
          </button>
          <button
            onClick={() => {
              setIsOpen(false)
              router.push('/app/workspace-settings')
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-sm text-gray-700"
          >
            <Settings className="h-4 w-4" />
            <span>Manage Workspace</span>
          </button>
        </div>
      </PopoverContent>
      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleWorkspaceCreated}
      />
    </Popover>
  )
}

