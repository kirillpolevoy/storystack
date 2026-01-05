'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { WorkspaceErrorBoundary } from '@/components/errors/WorkspaceErrorBoundary'
import { WorkspaceSwitchLoader } from '@/components/app/WorkspaceSwitchLoader'
import { initializeWorkspaceQueryPlugin } from '@/plugins/workspaceQueryPlugin'
import { TrialGateProvider } from '@/components/subscription/TrialGateProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          refetchOnWindowFocus: false,
        },
      },
    })
    
    // Initialize workspace query plugin
    initializeWorkspaceQueryPlugin(client)
    
    return client
  })

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100%' }}>
      <QueryClientProvider client={queryClient}>
        <WorkspaceErrorBoundary>
          <WorkspaceProvider>
            <TrialGateProvider>
              <WorkspaceSwitchLoader />
              {children}
            </TrialGateProvider>
          </WorkspaceProvider>
        </WorkspaceErrorBoundary>
      </QueryClientProvider>
    </div>
  )
}




