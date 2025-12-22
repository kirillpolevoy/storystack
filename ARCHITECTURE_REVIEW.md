# Workspace-Based Data Rendering - Architecture Review & Improvements

## Current Architecture Analysis

### Strengths
1. ✅ Uses React Query for data fetching and caching
2. ✅ Centralized `useActiveWorkspace` hook for workspace state
3. ✅ Query keys include workspace ID for proper isolation
4. ✅ Event-driven updates (storage events + custom events)

### Critical Issues

#### 1. **Scattered localStorage Access**
**Problem**: Multiple components read localStorage directly instead of using the hook
- `tags/page.tsx` - 5 direct reads
- `UploadZone.tsx` - direct read
- `pollBatchStatus.ts` - direct read
- `upload.ts` - direct read
- `WorkspaceSwitcher.tsx` - direct read

**Impact**: 
- Non-reactive to workspace changes
- Inconsistent state across components
- Race conditions

#### 2. **Duplicated Query Invalidation Logic**
**Problem**: Query invalidation logic is duplicated in 3+ places:
- `useActiveWorkspace` hook (storage event handler)
- `useActiveWorkspace` hook (custom event handler)  
- `useActiveWorkspace` hook (workspace change effect)
- `WorkspaceSwitcher` component

**Impact**:
- Hard to maintain
- Easy to miss invalidating some queries
- Inconsistent behavior

#### 3. **Side Effects in useMemo**
**Problem**: `useMemo` performs localStorage writes and DB updates
```typescript
// In useActiveWorkspace.ts - BAD
const activeWorkspaceId = useMemo(() => {
  // ... validation logic ...
  localStorage.setItem('@storystack:active_workspace_id', ownWorkspace.id) // Side effect!
  supabase.from('user_preferences').upsert(...) // Side effect!
  return ownWorkspace.id
}, [dependencies])
```

**Impact**:
- Violates React rules (side effects in render)
- Unpredictable execution timing
- Hard to test

#### 4. **Aggressive Query Cleanup**
**Problem**: Removing ALL queries on workspace change causes:
- UI flicker
- Loss of scroll position
- Unnecessary re-fetches
- Poor UX

#### 5. **No Centralized Workspace Change Handler**
**Problem**: Workspace switching logic is scattered:
- `WorkspaceSwitcher` handles UI state
- `useActiveWorkspace` handles query invalidation
- No single source of truth for workspace operations

#### 6. **Race Conditions**
**Problem**: Multiple async operations without coordination:
- localStorage update
- Event dispatch
- Query invalidation
- Component re-renders

**Impact**: Queries might fetch with wrong workspace ID

#### 7. **No Workspace Context**
**Problem**: No React Context to provide workspace state tree-wide
- Forces prop drilling
- No centralized loading/error states
- Hard to add workspace-scoped features

#### 8. **Inconsistent Query Key Patterns**
**Problem**: Some queries include workspace ID, some don't:
- `['assets', activeWorkspaceId, ...]` ✅
- `['tags', activeWorkspaceId]` ✅
- `['workspace', activeWorkspaceId]` ✅
- `['user_preferences', user?.id]` ❌ (should include workspace context)

#### 9. **No Error Boundaries**
**Problem**: No handling for workspace fetch failures
- User sees broken state
- No retry mechanism
- No fallback workspace

#### 10. **Missing Loading States**
**Problem**: No unified loading state during workspace switch
- Users don't know when switch is complete
- Can't show skeleton loaders
- Poor perceived performance

---

## Proposed Architecture Improvements

### 1. **Create WorkspaceContext Provider**

```typescript
// contexts/WorkspaceContext.tsx
interface WorkspaceContextValue {
  activeWorkspaceId: string | null
  isLoading: boolean
  error: Error | null
  switchWorkspace: (workspaceId: string) => Promise<void>
  workspaces: Workspace[]
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Centralized workspace state management
  // Provides workspace state to entire app tree
}
```

**Benefits**:
- Single source of truth
- Centralized loading/error states
- Easy to add workspace-scoped features
- Better testability

### 2. **Centralized Workspace Change Handler**

```typescript
// hooks/useWorkspaceManager.ts
export function useWorkspaceManager() {
  const queryClient = useQueryClient()
  
  const switchWorkspace = useCallback(async (workspaceId: string) => {
    // 1. Set loading state
    // 2. Cancel in-flight queries for old workspace
    // 3. Update localStorage
    // 4. Dispatch event
    // 5. Invalidate queries (not remove - preserve for back navigation)
    // 6. Wait for queries to refetch
    // 7. Clear loading state
  }, [queryClient])
  
  return { switchWorkspace }
}
```

**Benefits**:
- Single place for workspace switching logic
- Coordinated async operations
- Better error handling
- Loading states

### 3. **Query Key Factory Pattern**

```typescript
// utils/queryKeys.ts
export const queryKeys = {
  // Workspace-scoped queries
  assets: (workspaceId: string | null, filters?: any) => 
    ['assets', workspaceId, ...(filters ? [filters] : [])] as const,
  
  tags: (workspaceId: string | null) => 
    ['tags', workspaceId] as const,
  
  stories: (workspaceId: string | null) => 
    ['stories', workspaceId] as const,
  
  // Global queries
  user: () => ['user'] as const,
  workspaces: (userId: string) => ['workspaces', userId] as const,
}

// Usage
const { data } = useQuery({
  queryKey: queryKeys.assets(activeWorkspaceId, filters),
  queryFn: () => fetchAssets(activeWorkspaceId, filters),
})
```

**Benefits**:
- Type-safe query keys
- Consistent patterns
- Easy to invalidate related queries
- Better IDE autocomplete

### 4. **React Query Plugin for Workspace Changes**

```typescript
// plugins/workspaceQueryPlugin.ts
export function workspaceQueryPlugin(queryClient: QueryClient) {
  // Intercept workspace changes
  // Automatically invalidate workspace-scoped queries
  // Handle query cleanup
  // Provide loading states
}
```

**Benefits**:
- Automatic query management
- Less boilerplate
- Consistent behavior

### 5. **Move Side Effects Out of useMemo**

```typescript
// hooks/useActiveWorkspace.ts - IMPROVED
export function useActiveWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  
  // Compute active workspace ID (no side effects)
  const activeWorkspaceId = useMemo(() => {
    // Pure computation only
    return computeActiveWorkspaceId(localStorageId, dbId, workspaces, user)
  }, [localStorageId, dbId, workspaces, user])
  
  // Handle side effects in useEffect
  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== workspaceId) {
      // Sync to localStorage
      // Update database
      // Dispatch events
      setWorkspaceId(activeWorkspaceId)
    }
  }, [activeWorkspaceId, workspaceId])
  
  return activeWorkspaceId
}
```

**Benefits**:
- Follows React rules
- Predictable execution
- Easier to test
- Better performance

### 6. **Optimistic Updates**

```typescript
// When switching workspace, optimistically update UI
const switchWorkspace = async (workspaceId: string) => {
  // 1. Optimistically update UI
  queryClient.setQueryData(['activeWorkspace'], workspaceId)
  
  // 2. Update localStorage
  localStorage.setItem('@storystack:active_workspace_id', workspaceId)
  
  // 3. Invalidate queries (they'll refetch with new workspace ID)
  queryClient.invalidateQueries({ 
    predicate: (query) => isWorkspaceScopedQuery(query.queryKey)
  })
  
  // 4. Sync to database (fire and forget)
  syncToDatabase(workspaceId).catch(console.error)
}
```

**Benefits**:
- Instant UI updates
- Better perceived performance
- Graceful degradation

### 7. **Workspace-Scoped Query Utilities**

```typescript
// utils/workspaceQueries.ts
export function isWorkspaceScopedQuery(queryKey: readonly unknown[]): boolean {
  const workspaceScopedKeys = ['assets', 'tags', 'stories', 'availableTags', 'availableLocations']
  return workspaceScopedKeys.includes(queryKey[0] as string)
}

export function invalidateWorkspaceQueries(
  queryClient: QueryClient,
  workspaceId?: string | null
) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      if (!isWorkspaceScopedQuery(query.queryKey)) return false
      if (workspaceId) {
        return query.queryKey[1] === workspaceId
      }
      return true // Invalidate all workspace queries
    }
  })
}
```

**Benefits**:
- Reusable utilities
- Type-safe
- Easy to extend

### 8. **Error Handling & Fallbacks**

```typescript
// hooks/useActiveWorkspace.ts - IMPROVED
export function useActiveWorkspace() {
  const [error, setError] = useState<Error | null>(null)
  
  // If workspace fetch fails, fallback to first available workspace
  const { data: workspaces, error: workspacesError } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: fetchWorkspaces,
    retry: 3,
    onError: (err) => {
      setError(err)
      // Fallback to cached workspace or first available
    }
  })
  
  return { activeWorkspaceId, error, isLoading }
}
```

**Benefits**:
- Graceful error handling
- Better UX
- Automatic recovery

### 9. **Loading States During Workspace Switch**

```typescript
// contexts/WorkspaceContext.tsx
const WorkspaceProvider = ({ children }) => {
  const [isSwitching, setIsSwitching] = useState(false)
  
  const switchWorkspace = async (workspaceId: string) => {
    setIsSwitching(true)
    try {
      // ... switch logic ...
      await Promise.all([
        queryClient.refetchQueries({ predicate: isWorkspaceScopedQuery }),
        syncToDatabase(workspaceId)
      ])
    } finally {
      setIsSwitching(false)
    }
  }
  
  return (
    <WorkspaceContext.Provider value={{ isSwitching, ... }}>
      {isSwitching && <WorkspaceSwitchLoader />}
      {children}
    </WorkspaceContext.Provider>
  )
}
```

**Benefits**:
- Clear user feedback
- Prevents double-clicks
- Better UX

### 10. **Remove Direct localStorage Access**

**Action**: Replace all direct localStorage reads with `useActiveWorkspace()` hook

**Files to update**:
- `apps/web/app/app/tags/page.tsx` (5 instances)
- `apps/web/components/library/UploadZone.tsx`
- `apps/web/utils/pollBatchStatus.ts`
- `apps/web/utils/upload.ts`
- `apps/web/components/app/WorkspaceSwitcher.tsx`

---

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. ✅ Replace direct localStorage reads with `useActiveWorkspace()` hook
2. ✅ Move side effects out of `useMemo`
3. ✅ Centralize query invalidation logic

### Phase 2: Architecture Improvements (Short-term)
4. Create `WorkspaceContext` provider
5. Implement centralized workspace change handler
6. Add query key factory
7. Add loading states

### Phase 3: Advanced Features (Long-term)
8. Implement optimistic updates
9. Add error boundaries and fallbacks
10. Create React Query plugin
11. Add workspace-scoped query utilities

---

## Migration Strategy

1. **Incremental**: Implement improvements incrementally, testing at each step
2. **Backward Compatible**: Keep existing API working during migration
3. **Feature Flags**: Use feature flags to gradually roll out improvements
4. **Monitoring**: Add logging/metrics to track workspace switch performance

---

## Performance Considerations

### Current Issues
- Multiple query invalidations cause unnecessary re-renders
- Aggressive query removal causes flicker
- No query result caching across workspace switches

### Improvements
- Use `queryClient.setQueryData()` to preserve data when possible
- Batch query invalidations
- Implement query result prefetching for likely workspace switches
- Use React Query's `keepPreviousData` option for smoother transitions

---

## Testing Strategy

1. **Unit Tests**: Test workspace change logic in isolation
2. **Integration Tests**: Test workspace switching end-to-end
3. **E2E Tests**: Test workspace switching in real user flows
4. **Performance Tests**: Measure workspace switch latency
5. **Error Scenarios**: Test error handling and fallbacks

---

## Conclusion

The current architecture works but has several maintainability and UX issues. The proposed improvements will:

1. ✅ Eliminate race conditions
2. ✅ Improve code maintainability
3. ✅ Better user experience
4. ✅ Easier to test
5. ✅ More scalable

**Recommended Next Steps**:
1. Fix direct localStorage access (Phase 1)
2. Create WorkspaceContext (Phase 2)
3. Implement centralized workspace change handler (Phase 2)
4. Add query key factory (Phase 2)

