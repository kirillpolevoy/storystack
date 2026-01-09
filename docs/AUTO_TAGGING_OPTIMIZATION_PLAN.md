# Auto-Tagging Architecture Optimization Plan

## Executive Summary

The current auto-tagging system has scalability concerns for large batch uploads (300+ images) and concurrent users. This document analyzes the existing architecture, identifies bottlenecks, and proposes optimizations.

---

## Current Architecture Analysis

### Decision Logic
```
Images < 20  → Real-time API (synchronous, ~2-5s per image)
Images ≥ 20  → Batch API (async, up to 24 hours)
```

### Key Components
| Component | File | Purpose |
|-----------|------|---------|
| Edge Function | `supabase/functions/auto_tag_asset/index.ts` | Processing gateway |
| Client Queue | `utils/autoTagQueue.ts` | Local request batching |
| Batch Polling | `apps/web/utils/pollBatchStatus.ts` | Status monitoring |

### Current Limits
| Parameter | Value | Notes |
|-----------|-------|-------|
| Batch API Threshold | 20 images | Triggers async processing |
| Real-time Batch Size | 5 images | Queue chunking |
| Poll Interval | 10 seconds | Client-side |
| Max Poll Duration | 1 hour | Then stops |
| OpenAI Batch SLA | 24 hours | May complete faster |

---

## Problem Analysis

### Problem 1: Large Batch Processing Time (300+ images)

**Scenario**: User uploads 300 images at once

**Current Behavior**:
1. All 300 images submitted as single OpenAI Batch
2. OpenAI processes within 24-hour window
3. Actual processing time: **15 minutes to 12+ hours** (unpredictable)
4. User sees "Tagging..." spinner for entire duration

**Root Cause**:
- OpenAI Batch API prioritizes cost savings (50%) over speed
- No SLA for faster completion
- Processing time scales with queue depth across all OpenAI customers

**Evidence from Community**:
> "Batch API 'in-progress' more than 12H for GPT-4.1-mini" - [OpenAI Forum](https://community.openai.com/t/batch-api-in-progress-more-than-12h-for-gpt-4-1-mini/1255766)

### Problem 2: Rate Limiting with Concurrent Users (<20 images)

**Scenario**: 10 users each upload 15 images simultaneously

**Current Behavior**:
1. Each user triggers real-time API (under 20 threshold)
2. 10 × 15 = 150 concurrent OpenAI API calls
3. Rate limit hit → 429 errors → exponential backoff
4. Some users experience 30+ second delays

**Rate Limit Structure** (gpt-4o-mini):
| Tier | RPM | TPM |
|------|-----|-----|
| Tier 1 | 500 | 200,000 |
| Tier 2 | 5,000 | 2,000,000 |
| Tier 3 | 5,000 | 4,000,000 |

**Calculation**:
- Each image request ≈ 1,500-3,000 tokens (vision + response)
- 150 images = 225,000-450,000 tokens
- At Tier 1: Would exceed 200K TPM limit
- At Tier 2: Within limits but RPM could be issue

### Problem 3: Polling Inefficiency

**Current**: 360 polls × 10 seconds = 1 hour max
- Each poll queries database for ALL pending assets
- Each poll makes HTTP request to edge function
- No push notifications when batch completes

**Impact**: Unnecessary load on database and edge function

---

## Proposed Solutions

### Solution 1: Hybrid Processing Strategy

Replace binary batch/real-time decision with intelligent routing:

```
Images 1-5     → Real-time API (immediate results)
Images 6-50    → Real-time API with chunking (5 at a time, 2s delay)
Images 51-200  → Batch API (accept 1-4 hour wait)
Images 201+    → Split into multiple batches (parallel processing)
```

**Implementation**:
```typescript
const REALTIME_IMMEDIATE_THRESHOLD = 5;
const REALTIME_CHUNKED_THRESHOLD = 50;
const BATCH_SINGLE_THRESHOLD = 200;
const CHUNK_SIZE = 5;
const CHUNK_DELAY_MS = 2000;

function determineProcessingStrategy(imageCount: number) {
  if (imageCount <= REALTIME_IMMEDIATE_THRESHOLD) {
    return { type: 'realtime', chunks: 1 };
  }
  if (imageCount <= REALTIME_CHUNKED_THRESHOLD) {
    return {
      type: 'realtime-chunked',
      chunks: Math.ceil(imageCount / CHUNK_SIZE),
      delayMs: CHUNK_DELAY_MS
    };
  }
  if (imageCount <= BATCH_SINGLE_THRESHOLD) {
    return { type: 'batch', batches: 1 };
  }
  // Split into multiple batches for faster parallel processing
  return {
    type: 'batch-parallel',
    batches: Math.ceil(imageCount / BATCH_SINGLE_THRESHOLD)
  };
}
```

**Benefits**:
- Small uploads (1-5): Instant results
- Medium uploads (6-50): ~20-100 seconds total, predictable
- Large uploads (51-200): Uses batch, but single batch
- Very large uploads (201+): Parallel batches may complete faster

### Solution 2: Server-Side Rate Limiting & Queuing

Add workspace-level rate limiting at edge function:

```typescript
// In edge function
const RATE_LIMITS = {
  realtime: {
    requestsPerMinute: 30,      // Per workspace
    tokensPerMinute: 100000,    // Per workspace
  },
  batch: {
    batchesPerHour: 10,         // Per workspace
    imagesPerHour: 5000,        // Per workspace
  }
};

async function checkRateLimit(
  workspaceId: string,
  requestType: 'realtime' | 'batch',
  imageCount: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `ratelimit:${workspaceId}:${requestType}`;
  // Use Redis or Supabase to track
  // Return retry-after if exceeded
}
```

**Implementation Options**:
1. **Supabase Table**: `workspace_rate_limits` with sliding window
2. **Redis/Upstash**: For distributed rate limiting
3. **Edge Function Memory**: Simple in-memory (resets on cold start)

### Solution 3: Progressive UI Feedback

Replace binary "Tagging..." with stages:

```typescript
type TaggingStage =
  | 'queued'           // Waiting in local queue
  | 'preparing'        // Image preparation
  | 'submitted'        // Sent to OpenAI
  | 'processing'       // OpenAI working
  | 'completing'       // Downloading results
  | 'completed'        // Done
  | 'failed';          // Error

// Database schema addition
ALTER TABLE assets ADD COLUMN tagging_stage TEXT;
ALTER TABLE assets ADD COLUMN tagging_progress INTEGER; -- 0-100
ALTER TABLE assets ADD COLUMN tagging_eta TIMESTAMP;
```

**UI States**:
| Stage | Message | Visual |
|-------|---------|--------|
| queued | "Queued for tagging" | Gray badge |
| preparing | "Preparing images..." | Spinner |
| submitted | "Submitted to AI" | Progress bar |
| processing | "AI analyzing (~X min)" | Progress bar + ETA |
| completing | "Saving tags..." | Progress bar 90% |

### Solution 4: Webhook-Based Completion (Replace Polling)

Instead of client polling, use server-to-server webhooks:

```typescript
// 1. Create batch with callback URL
const batch = await openai.batches.create({
  input_file_id: fileId,
  endpoint: '/v1/chat/completions',
  completion_window: '24h',
  metadata: {
    callback_url: `${SUPABASE_URL}/functions/v1/batch-webhook`,
    workspace_id: workspaceId
  }
});

// 2. Separate webhook edge function
// supabase/functions/batch-webhook/index.ts
Deno.serve(async (req) => {
  const { batch_id, status } = await req.json();

  if (status === 'completed') {
    // Process results
    await processBatchResults(batch_id);

    // Notify connected clients via Supabase Realtime
    await supabase
      .channel('batch-updates')
      .send({
        type: 'broadcast',
        event: 'batch-complete',
        payload: { batch_id }
      });
  }
});

// 3. Client subscribes to realtime channel
const channel = supabase.channel('batch-updates')
  .on('broadcast', { event: 'batch-complete' }, (payload) => {
    queryClient.invalidateQueries(['assets']);
  })
  .subscribe();
```

**Note**: OpenAI doesn't natively support webhooks. Alternative:
- Use Supabase CRON to poll (server-side, once per minute)
- Reduces client load from 360 polls/hour to 60 server polls/hour

### Solution 5: Batch Splitting for Very Large Uploads

For 300+ images, split into parallel batches:

```typescript
const MAX_IMAGES_PER_BATCH = 100; // Optimize for faster completion

async function createParallelBatches(assets: Asset[], workspaceId: string) {
  const batches = chunk(assets, MAX_IMAGES_PER_BATCH);

  const batchIds = await Promise.all(
    batches.map((batch, index) =>
      createOpenAIBatch(batch, {
        priority: index === 0 ? 'high' : 'normal', // First batch faster
        metadata: {
          workspace_id: workspaceId,
          batch_index: index,
          total_batches: batches.length
        }
      })
    )
  );

  return batchIds;
}
```

**Rationale**:
- Smaller batches may complete faster (less queue time)
- Parallel batches = parallel processing potential
- First batch prioritized for quick initial feedback

---

## Recommended Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. **Raise real-time threshold to 50** (reduce batch API usage)
2. **Add chunked processing for 6-50 images** (controlled rate)
3. **Improve UI messaging** (show progress stages)

### Phase 2: Rate Limiting (3-5 days)
4. **Add workspace rate limiting** (prevent abuse)
5. **Server-side polling via CRON** (reduce client load)
6. **Batch splitting for 200+ images**

### Phase 3: Advanced (1-2 weeks)
7. **Supabase Realtime for completion notifications**
8. **Predictive ETA based on historical data**
9. **Per-user usage tracking and quotas**

---

## Answers to Specific Questions

### Q1: 300+ images - are users waiting 8+ hours?

**Current**: Yes, potentially. OpenAI Batch API has 24-hour SLA with no guarantees.

**With Optimizations**:
- Split into 3 batches of 100 images
- Parallel processing may complete in 1-4 hours
- First batch (100 images) may complete in 15-60 minutes
- User sees partial results faster

### Q2: Rate limiting with concurrent <20 image uploads?

**Current Risk**: HIGH
- 10 concurrent users × 15 images = 150 API calls
- At Tier 1 (500 RPM): Would hit limit in ~20 seconds
- At Tier 2 (5000 RPM): Safe for RPM, but TPM could be issue

**With Optimizations**:
- Server-side queue with 30 RPM per workspace
- Chunked processing with delays
- Automatic fallback to batch API if rate limited

---

## Appendix: OpenAI API Limits Reference

### Real-time API (gpt-4o-mini)
| Tier | RPM | TPM | TPD |
|------|-----|-----|-----|
| Free | 3 | 200 | - |
| Tier 1 | 500 | 200,000 | - |
| Tier 2 | 5,000 | 2,000,000 | - |
| Tier 3 | 5,000 | 4,000,000 | - |

### Batch API (gpt-4o-mini)
| Limit | Value |
|-------|-------|
| Max requests per batch | 50,000 |
| Max file size | 200 MB |
| Token queue limit | Separate from real-time |
| Completion window | 24 hours |
| Cost savings | 50% vs real-time |

Sources:
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [Batch API Documentation](https://platform.openai.com/docs/guides/batch)
- [Batch API FAQ](https://help.openai.com/en/articles/9197833-batch-api-faq)
- [OpenAI Pricing](https://openai.com/api/pricing/)
