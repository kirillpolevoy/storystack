'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type AuditLogEntry = {
  id: string
  workspace_id: string
  actor_user_id: string | null
  actor_email: string | null
  entity_type: string
  entity_id: string | null
  action: string
  diff: any
  created_at: string
}

export function useAssetAuditLog(assetId: string, workspaceId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['assetAuditLog', assetId, workspaceId],
    queryFn: async () => {
      // Fetch audit log entries for the asset itself
      const { data: assetEntries, error: assetError } = await supabase
        .from('audit_log')
        .select(`
          id,
          workspace_id,
          actor_user_id,
          entity_type,
          entity_id,
          action,
          diff,
          created_at
        `)
        .eq('workspace_id', workspaceId)
        .eq('entity_type', 'assets')
        .eq('entity_id', assetId)
        .order('created_at', { ascending: false })

      if (assetError) throw assetError

      // Fetch audit log entries for asset_tags changes related to this asset
      // Note: entity_id in asset_tags audit entries is the asset_tags record ID, not the asset ID
      // We need to check the diff JSONB to see if it contains the asset_id
      const { data: tagEntries, error: tagError } = await supabase
        .from('audit_log')
        .select(`
          id,
          workspace_id,
          actor_user_id,
          entity_type,
          entity_id,
          action,
          diff,
          created_at
        `)
        .eq('workspace_id', workspaceId)
        .eq('entity_type', 'asset_tags')
        .order('created_at', { ascending: false })

      if (tagError) throw tagError

      // Filter tag entries to only those related to this asset
      const filteredTagEntries = (tagEntries || []).filter((entry) => {
        if (!entry.diff) return false
        // Check if diff contains asset_id matching our asset
        const diff = entry.diff
        return (
          diff.asset_id === assetId ||
          (diff.old && diff.old.asset_id === assetId) ||
          (diff.new && diff.new.asset_id === assetId)
        )
      })

      // Get tag IDs from asset_tags entries to look up tag names
      const tagIds = new Set<string>()
      filteredTagEntries.forEach((entry) => {
        if (entry.diff) {
          const tagId = entry.diff.tag_id || entry.diff.tagId
          if (tagId) tagIds.add(tagId)
        }
      })

      // Fetch tag names for tag IDs
      const tagNameMap = new Map<string, string>()
      if (tagIds.size > 0) {
        const { data: tags, error: tagsError } = await supabase
          .from('tags')
          .select('id, name')
          .in('id', Array.from(tagIds))
          .eq('workspace_id', workspaceId)

        if (!tagsError && tags) {
          tags.forEach((tag: { id: string; name: string }) => {
            tagNameMap.set(tag.id, tag.name)
          })
        }
      }

      // Enrich tag entries with tag names in diff
      const enrichedTagEntries = filteredTagEntries.map((entry) => {
        if (entry.diff) {
          const tagId = entry.diff.tag_id || entry.diff.tagId
          if (tagId && tagNameMap.has(tagId)) {
            return {
              ...entry,
              diff: {
                ...entry.diff,
                tag_name: tagNameMap.get(tagId),
              },
            }
          }
        }
        return entry
      })

      // Combine and sort all entries
      const allEntries = [...(assetEntries || []), ...enrichedTagEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // Get unique user IDs to fetch emails via RPC function
      const userIds = Array.from(
        new Set(
          allEntries
            .map((entry) => entry.actor_user_id)
            .filter((id): id is string => id !== null)
        )
      )

      // Fetch user emails using RPC function (if available) or leave as null
      const userEmailMap = new Map<string, string>()
      if (userIds.length > 0) {
        try {
          console.log('[useAssetAuditLog] Fetching emails for user IDs:', userIds)
          // Try to call RPC function to get user emails
          // If the function doesn't exist, we'll handle gracefully
          const { data: userEmails, error: rpcError } = await supabase.rpc(
            'get_user_emails',
            { user_ids: userIds }
          )

          if (rpcError) {
            console.error('[useAssetAuditLog] RPC error:', rpcError)
            console.error('[useAssetAuditLog] RPC error details:', JSON.stringify(rpcError, null, 2))
          } else if (userEmails) {
            console.log('[useAssetAuditLog] Received user emails:', userEmails)
            console.log('[useAssetAuditLog] User emails type:', typeof userEmails, Array.isArray(userEmails))
            if (Array.isArray(userEmails)) {
              userEmails.forEach((item: any) => {
                console.log('[useAssetAuditLog] Processing email item:', item)
                const userId = item.user_id || item.userId
                const email = item.email
                if (userId && email) {
                  userEmailMap.set(userId, email)
                }
              })
            }
            console.log('[useAssetAuditLog] Email map:', Array.from(userEmailMap.entries()))
          } else {
            console.warn('[useAssetAuditLog] No user emails returned from RPC (data is null/undefined)')
          }
        } catch (error) {
          // RPC function may not exist yet - that's okay, we'll show user IDs
          console.error('[useAssetAuditLog] Exception fetching user emails:', error)
        }
      } else {
        console.log('[useAssetAuditLog] No user IDs to fetch emails for')
      }

      // Map entries with email
      const entries: AuditLogEntry[] = allEntries.map((entry) => {
        const email = entry.actor_user_id ? userEmailMap.get(entry.actor_user_id) || null : null
        console.log(`[useAssetAuditLog] Entry ${entry.id}: user_id=${entry.actor_user_id}, email=${email}`)
        return {
          ...entry,
          actor_email: email,
        }
      })

      console.log('[useAssetAuditLog] Final entries with emails:', entries.map(e => ({ id: e.id, user_id: e.actor_user_id, email: e.actor_email })))

      return entries
    },
    enabled: !!assetId && !!workspaceId,
  })
}

