# Tab: Batch Analysis

**File:** `src/components/batch-analysis.tsx` · **Data:** reuses the analyze APIs · **Status:** ✅

## What it is
Queue multiple files/inputs and run analysis across them, tracking per-item progress and results.

## How it's built
Maintains a client-side queue (each item gets a unique id via `Date.now()+Math.random()` - legitimate id generation, not mock data). Iterates the queue, calling the relevant analyze endpoint per item, and renders per-item status.

## How it works (logic)
1. User adds items; each becomes a queue entry with `pending` status.
2. The component processes entries (sequentially/concurrently), calling `/api/analyze/*` per type.
3. Updates each entry with its result/risk; shows aggregate progress.

## Future scope & enterprise enhancements
- Move batching to a **server-side job queue** (BullMQ/worker) with retries, concurrency limits, and persistence - client-driven batches die on tab close.
- Bulk upload (zip/CSV of URLs), rate limiting, and a results export.
- Progress via WebSocket/SSE instead of client polling.
