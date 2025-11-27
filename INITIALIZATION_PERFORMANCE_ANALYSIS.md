# App Initialization Performance Analysis

## Summary
The app has **multiple layers of artificial delays and sequential database queries** that significantly slow down initialization. Total estimated delay: **~10-15 seconds** before the app is usable.

## Critical Bottlenecks

### 1. **App.tsx - Artificial Delays (4.5+ seconds)**
**Location:** `App.tsx` lines 61-94

**Issues:**
- **2000ms delay** waiting for app state to be active (line 72)
- **2000ms delay** for native module initialization (line 80)
- **500ms additional stabilization delay** (line 83)
- **3000ms fallback delay** on error (line 89)

**Total:** ~4.5-5 seconds of artificial delays

**Recommendation:** These delays appear to be workarounds for crashes. Consider:
- Reducing delays to minimal necessary values (100-200ms)
- Using proper initialization checks instead of fixed delays
- Only delaying if actually needed (check native module availability)

---

### 2. **_layout.tsx - Complex Initialization Sequence (5+ seconds)**
**Location:** `app/_layout.tsx` lines 86-152

**Issues:**
- **Up to 3.2 seconds** waiting for loading screen mount/layout (200 attempts × 16ms, line 93-96)
- **500ms delay** after layout completion (line 100)
- **Multiple nested requestAnimationFrame waits** (lines 107-118) - adds ~66ms per frame (4 frames = ~264ms)
- **2000ms delay** after splash hidden (line 139)
- **500ms additional delay** (line 140)

**Total:** ~5+ seconds of delays

**Recommendation:**
- Reduce mount wait to reasonable timeout (e.g., 500ms max)
- Remove redundant delays after splash screen is hidden
- Use `InteractionManager.runAfterInteractions()` more efficiently
- Consider showing content immediately after auth is ready

---

### 3. **Sequential Database Queries in index.tsx**
**Location:** `app/index.tsx` lines 62-218

**Issues:**
- **getDefaultCampaignId()** makes **3 sequential calls**:
  1. `getSession()` - auth check
  2. `getUser()` - user ID fetch
  3. Database query for campaign (or create if missing)
  
- **getAllAvailableTags()** makes **4+ sequential queries**:
  1. `getUser()` - auth check
  2. Query `tag_config` for `deleted_tags`
  3. Query `tag_config` for `custom_tags`
  4. Query all `assets` to extract tags

- **loadAssets()** makes **2 sequential calls**:
  1. `getUser()` - auth check
  2. Database query for assets

**Total:** 9+ sequential database/API calls blocking initialization

**Recommendation:**
- **Parallelize independent queries** using `Promise.all()`
- Cache user ID after first fetch (don't call `getUser()` multiple times)
- Combine `tag_config` queries into a single query
- Load tags lazily (after assets are loaded) or in parallel with assets

---

### 4. **Redundant Auth Checks**
**Location:** Multiple files

**Issues:**
- `getDefaultCampaignId()` calls `getSession()` then `getUser()` (lines 19, 26)
- `getAllAvailableTags()` calls `getUser()` (line 25)
- `loadAssets()` calls `getUser()` (line 133)
- `AuthContext` already provides `session` and `user` - these are redundant

**Recommendation:**
- Use `session.user.id` from `AuthContext` instead of calling `getUser()` repeatedly
- Pass user ID as parameter to utility functions

---

### 5. **getAllAvailableTags - Inefficient Query Pattern**
**Location:** `utils/getAllAvailableTags.ts` lines 18-143

**Issues:**
- Makes **3 separate database queries** that could be combined:
  1. Query for `deleted_tags` (lines 37-41)
  2. Query for `custom_tags` (lines 75-79)
  3. Query for all assets (lines 112-115)

- Queries all assets just to extract tags (could be expensive with many assets)

**Recommendation:**
- Combine `tag_config` queries: `select('deleted_tags, custom_tags')` in one query
- Consider caching tags or loading them lazily
- If possible, maintain a separate tags table instead of scanning all assets

---

### 6. **AuthContext - Blocking Session Load**
**Location:** `contexts/AuthContext.tsx` lines 27-32

**Issues:**
- `getSession()` is awaited before setting loading to false
- This blocks the entire app initialization

**Recommendation:**
- Consider optimistic loading (show UI immediately, update when session loads)
- Use cached session from AsyncStorage if available

---

## Performance Optimization Recommendations

### Priority 1: Remove/Reduce Artificial Delays
1. **App.tsx**: Reduce delays to 100-200ms max, only if needed
2. **_layout.tsx**: Remove redundant delays, especially after splash is hidden
3. Use proper readiness checks instead of fixed timeouts

### Priority 2: Parallelize Database Queries
1. **Combine tag_config queries** into single query
2. **Load campaign and tags in parallel** using `Promise.all()`
3. **Cache user ID** from AuthContext instead of repeated `getUser()` calls

### Priority 3: Optimize Query Patterns
1. **Lazy load tags** - load after assets are visible
2. **Cache frequently accessed data** (campaign ID, tags)
3. **Use select() to limit columns** (already done for assets, good!)

### Priority 4: Improve Auth Flow
1. **Use session from AuthContext** instead of repeated auth checks
2. **Show UI optimistically** while auth loads in background
3. **Cache session** in memory after first load

---

## Estimated Performance Improvement

**Current:** ~10-15 seconds to usable state
**After optimizations:** ~2-3 seconds to usable state

**Breakdown:**
- Remove artificial delays: **-7 seconds**
- Parallelize queries: **-2-3 seconds**
- Optimize auth checks: **-1 second**
- Lazy load non-critical data: **-1 second**

---

## Implementation Order

1. **Quick wins** (30 min):
   - Reduce artificial delays in App.tsx and _layout.tsx
   - Use session.user.id from AuthContext instead of getUser()

2. **Medium effort** (2-3 hours):
   - Parallelize database queries
   - Combine tag_config queries
   - Cache user ID

3. **Long-term** (1-2 days):
   - Implement proper caching layer
   - Lazy load tags
   - Optimize query patterns

