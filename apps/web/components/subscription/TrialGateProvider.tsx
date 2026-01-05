'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { TrialGateModal } from './TrialGateModal'
import { ReadOnlyModal } from './ReadOnlyModal'
import { useWriteAccessGuard, AccessCheckResult } from '@/hooks/useWorkspaceAccess'

type GateReason = AccessCheckResult['reason']
type ModalType = 'trial' | 'readonly' | null

interface TrialGateContextValue {
  /**
   * Check upload access and either execute the action or show trial modal.
   * Uploads require an active subscription (trialing, active, past_due).
   */
  withUploadAccess: (action: () => void | Promise<void>) => Promise<boolean>

  /**
   * Check edit access and either execute the action or show read-only modal.
   * Editing is blocked only when subscription has ended (canceled, unpaid, inactive).
   */
  withEditAccess: (action: () => void | Promise<void>) => Promise<boolean>

  /** Can upload new assets */
  canUpload: boolean

  /** Can edit existing content */
  canEdit: boolean

  /** Whether the access check is still loading */
  isLoading: boolean

  /** Whether the current user is the workspace owner */
  isOwner: boolean

  /** The owner's subscription status */
  ownerSubscriptionStatus: string
}

const TrialGateContext = createContext<TrialGateContextValue | null>(null)

interface TrialGateProviderProps {
  children: ReactNode
}

export function TrialGateProvider({ children }: TrialGateProviderProps) {
  const [modalType, setModalType] = useState<ModalType>(null)
  const [gateReason, setGateReason] = useState<GateReason | undefined>(undefined)

  const { checkUploadAccess, checkEditAccess, canUpload, canEdit, isOwner, ownerSubscriptionStatus, isLoading } = useWriteAccessGuard()

  const withUploadAccess = useCallback(async (action: () => void | Promise<void>): Promise<boolean> => {
    const result = checkUploadAccess()

    if (result.allowed) {
      await action()
      return true
    }

    // Show trial modal for upload blocking
    setGateReason(result.reason)
    setModalType('trial')
    return false
  }, [checkUploadAccess])

  const withEditAccess = useCallback(async (action: () => void | Promise<void>): Promise<boolean> => {
    const result = checkEditAccess()

    if (result.allowed) {
      await action()
      return true
    }

    // Show read-only modal for edit blocking (subscription ended)
    setGateReason(result.reason)
    setModalType('readonly')
    return false
  }, [checkEditAccess])

  const handleModalClose = useCallback(() => {
    setModalType(null)
    setGateReason(undefined)
  }, [])

  return (
    <TrialGateContext.Provider
      value={{
        withUploadAccess,
        withEditAccess,
        canUpload,
        canEdit,
        isLoading,
        isOwner,
        ownerSubscriptionStatus,
      }}
    >
      {children}
      <TrialGateModal
        open={modalType === 'trial'}
        onOpenChange={(open) => !open && handleModalClose()}
        reason={gateReason === 'loading' ? undefined : gateReason}
      />
      <ReadOnlyModal
        open={modalType === 'readonly'}
        onOpenChange={(open) => !open && handleModalClose()}
        isOwner={isOwner}
      />
    </TrialGateContext.Provider>
  )
}

/**
 * Hook to access the trial gate functionality
 * Must be used within a TrialGateProvider
 */
export function useTrialGate() {
  const context = useContext(TrialGateContext)
  if (!context) {
    throw new Error('useTrialGate must be used within a TrialGateProvider')
  }
  return context
}
