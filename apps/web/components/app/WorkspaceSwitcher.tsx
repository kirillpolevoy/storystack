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

interface Workspace {
  id: string
  name: string
  logo_path?: string | null
}

export function WorkspaceSwitcher() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
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
            logo_path
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

  // Get active workspace - prefer stored, fallback to first workspace
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0]

  // Auto-select first workspace if none is set
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspaceId && activeWorkspace) {
      console.log('[WorkspaceSwitcher] Auto-selecting first workspace:', activeWorkspace.id)
      setActiveWorkspaceId(activeWorkspace.id)
      localStorage.setItem('@storystack:active_workspace_id', activeWorkspace.id)
      // Invalidate queries to refetch with new workspace
      queryClient.invalidateQueries()
    } else if (activeWorkspace && activeWorkspace.id !== activeWorkspaceId) {
      // Update if workspace changed
      setActiveWorkspaceId(activeWorkspace.id)
      localStorage.setItem('@storystack:active_workspace_id', activeWorkspace.id)
    }
  }, [workspaces, activeWorkspace, activeWorkspaceId, queryClient])

  const handleSwitchWorkspace = async (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId)
    localStorage.setItem('@storystack:active_workspace_id', workspaceId)
    setIsOpen(false)
    // Invalidate all queries to refetch with new workspace
    queryClient.invalidateQueries()
    // Refresh the page to reload workspace-scoped data
    window.location.reload()
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
          className="h-9 px-3 gap-2 justify-between w-full"
        >
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
              router.push('/app/workspace-settings')
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-sm text-gray-700"
          >
            <Settings className="h-4 w-4" />
            <span>Manage Workspace</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

