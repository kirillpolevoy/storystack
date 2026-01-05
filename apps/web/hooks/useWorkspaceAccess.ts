'use client'

import { useQuery } from '@tanstack/react-query'
import { useActiveWorkspace } from './useActiveWorkspace'
import { createClient } from '@/lib/supabase/client'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'inactive' | 'none'

export interface WorkspaceAccessInfo {
  /** Can upload new assets - requires active subscription */
  canUpload: boolean
  /** Can edit existing assets/stories/tags - blocked only after subscription ends */
  canEdit: boolean
  /** Owner's subscription status */
  ownerSubscriptionStatus: SubscriptionStatus
  /** Whether current user is the workspace owner */
  isOwner: boolean
  /** Whether access check is still loading */
  isLoading: boolean
  /** Error if access check failed */
  error: Error | null
}

/**
 * Hook to check workspace access permissions based on owner's subscription status.
 *
 * Access rules:
 * - No subscription yet: Can edit everything, CANNOT upload (encourages trial signup)
 * - Trialing/Active/Past Due: Full access (can upload and edit)
 * - Canceled/Unpaid/Inactive: Read-only (cannot upload or edit)
 */
export function useWorkspaceAccess(): WorkspaceAccessInfo {
  const workspaceId = useActiveWorkspace()

  const { data, isLoading, error } = useQuery({
    queryKey: ['workspace-access', workspaceId],
    queryFn: async () => {
      if (!workspaceId) {
        return {
          canUpload: false,
          canEdit: true, // Default to allowing edits when no workspace
          ownerSubscriptionStatus: 'none' as const,
          isOwner: false,
        }
      }

      const supabase = createClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return {
          canUpload: false,
          canEdit: false,
          ownerSubscriptionStatus: 'none' as const,
          isOwner: false,
        }
      }

      // Get workspace owner subscription status using our new function
      const { data: ownerSub, error: subError } = await supabase
        .rpc('get_workspace_owner_subscription', { p_workspace_id: workspaceId })
        .single<{
          owner_id: string | null
          status: string
          current_period_end: string | null
          cancel_at_period_end: boolean
        }>()

      if (subError) {
        console.error('[useWorkspaceAccess] Error fetching owner subscription:', subError)
        throw subError
      }

      const status = (ownerSub?.status || 'none') as SubscriptionStatus
      const isOwner = ownerSub?.owner_id === user.id

      // Determine access based on subscription status
      // Upload: requires active subscription (trialing, active, past_due)
      const canUpload = ['trialing', 'active', 'past_due'].includes(status)

      // Edit: allowed unless subscription has ended (canceled, unpaid, inactive)
      // 'none' means no subscription yet - allow editing to let users try the app
      const canEdit = ['trialing', 'active', 'past_due', 'none'].includes(status)

      return {
        canUpload,
        canEdit,
        ownerSubscriptionStatus: status,
        isOwner,
      }
    },
    enabled: !!workspaceId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })

  return {
    canUpload: data?.canUpload ?? false,
    canEdit: data?.canEdit ?? true, // Default to allowing edits
    ownerSubscriptionStatus: data?.ownerSubscriptionStatus ?? 'none',
    isOwner: data?.isOwner ?? false,
    isLoading,
    error: error as Error | null,
  }
}

export type AccessCheckResult = {
  allowed: boolean
  reason?: 'loading' | 'no_subscription' | 'owner_no_subscription' | 'subscription_canceled' | 'owner_subscription_canceled' | 'subscription_inactive'
}

/**
 * Hook that provides functions to check access before actions.
 * - checkUploadAccess: For uploads (requires active subscription)
 * - checkEditAccess: For edits (blocked only after subscription ends)
 */
export function useWriteAccessGuard() {
  const { canUpload, canEdit, ownerSubscriptionStatus, isOwner, isLoading } = useWorkspaceAccess()

  /**
   * Check if user can upload new assets.
   * Requires active subscription (trialing, active, past_due).
   */
  const checkUploadAccess = (): AccessCheckResult => {
    if (isLoading) {
      return { allowed: false, reason: 'loading' }
    }

    if (canUpload) {
      return { allowed: true }
    }

    // Determine reason for blocking uploads
    if (ownerSubscriptionStatus === 'none') {
      if (isOwner) {
        return { allowed: false, reason: 'no_subscription' }
      }
      return { allowed: false, reason: 'owner_no_subscription' }
    }

    if (ownerSubscriptionStatus === 'canceled') {
      if (isOwner) {
        return { allowed: false, reason: 'subscription_canceled' }
      }
      return { allowed: false, reason: 'owner_subscription_canceled' }
    }

    return { allowed: false, reason: 'subscription_inactive' }
  }

  /**
   * Check if user can edit existing content.
   * Blocked only when subscription has ended (canceled, unpaid, inactive).
   */
  const checkEditAccess = (): AccessCheckResult => {
    if (isLoading) {
      return { allowed: false, reason: 'loading' }
    }

    if (canEdit) {
      return { allowed: true }
    }

    // Subscription has ended - full read-only mode
    if (ownerSubscriptionStatus === 'canceled') {
      if (isOwner) {
        return { allowed: false, reason: 'subscription_canceled' }
      }
      return { allowed: false, reason: 'owner_subscription_canceled' }
    }

    return { allowed: false, reason: 'subscription_inactive' }
  }

  return {
    checkUploadAccess,
    checkEditAccess,
    canUpload,
    canEdit,
    ownerSubscriptionStatus,
    isOwner,
    isLoading,
  }
}
