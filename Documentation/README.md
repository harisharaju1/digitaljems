# System Design Learning Roadmap — DigitalJems

This folder documents the system design learning journey built on top of the DigitalJems codebase. Each step teaches a real concept by implementing a real improvement to the app.

**Working branch:** `claude-edits`

---

## Progress

| Step | Concept | Category | Difficulty | Status | Doc |
|------|---------|----------|------------|--------|-----|
| 1 | Cursor-based pagination | Data layer | Beginner | Done | [step-01](./step-01-cursor-based-pagination.md) |
| 2 | Stale-while-revalidate caching | Data layer | Beginner | Done | [step-02](./step-02-swr-caching.md) |
| 3 | Full-text search + GIN indexes | Data layer | Intermediate | Not Started | — |
| 4 | Optimistic updates | API reliability | Intermediate | Not Started | — |
| 5 | Inventory transactions + race conditions | API reliability | Intermediate | Not Started | — |
| 6 | Rate limiting (token bucket) | API reliability | Intermediate | Not Started | — |
| 7 | Async job queue | Resilience | Intermediate | Not Started | — |
| 8 | Real-time pub/sub | Real-time | Intermediate | Not Started | — |
| 9 | Structured observability | Operations | Advanced | Not Started | — |
| 10 | .NET Core backend (monolith vs. microservices) | Architecture | Advanced | Future | — |

---

## The Learning Arc

```
Data fundamentals → API reliability → Resilience → Real-time → Operations → Architecture
Steps 1–3            Steps 4–6        Step 7       Step 8      Step 9        Step 10
```

Steps 1–2 are beginner-level weekends. Steps 3–6 each touch both the database layer and the frontend. Steps 7–9 are where the most interview-transferable concepts live.

---

## What Each Step Teaches

### Step 1 — Cursor-Based Pagination `Beginner`
**The problem:** Loading all products on every mount. At scale, `OFFSET N` forces PostgreSQL to scan and discard N rows before returning results — gets slower the deeper you paginate.

**The solution:** Replace `OFFSET` with a `WHERE created_at < cursor` clause. Since `created_at` is indexed, the DB jumps directly to the right position in O(log N) regardless of depth.

**Interview angle:** "How does Instagram's feed work?" — keyset pagination, not page numbers.

**Files changed:** `sdk.ts`, `products-store.ts`, `HomePage.tsx`

---

### Step 2 — Stale-While-Revalidate Caching `Beginner`
**The problem:** `loadProducts()` fires on every component mount. No concept of freshness — stale data shows forever, yet re-fetches happen anyway.

**The solution:** An in-memory cache keyed by query params with a TTL. Serve stale data instantly, revalidate in the background after expiry. Admin mutations call `cache.invalidate()`.

**Interview angle:** "How do you reduce API calls without serving stale data?" — SWR pattern.

**Files changed:** new `cache.ts`, `sdk.ts`, `products-store.ts`, `AdminProductForm.tsx`

---

### Step 3 — Full-Text Search + GIN Indexes `Intermediate`
**The problem:** Search runs a JavaScript `.filter()` on the full product list loaded into the browser. No debouncing — fires on every keystroke.

**The solution:** A `tsvector` generated column + GIN index on the `products` table. Server-side `.textSearch()` replaces the client filter. 300ms debounce on the input.

**Interview angle:** "Why is `LIKE '%query%'` slow?" — can't use a B-tree index. GIN is built for token containment.

**Files changed:** `schema.sql`, `sdk.ts`, `Header.tsx`

---

### Step 4 — Optimistic Updates `Intermediate`
**The problem:** Admin order status updates wait for the Supabase round-trip before the UI reflects the change. The user stares at a spinner for an operation that almost never fails.

**The solution:** Apply the change to Zustand state immediately, navigate away, confirm in the background, roll back on failure.

**Interview angle:** "How does Twitter show your like instantly?" — optimistic update with rollback.

**Files changed:** `AdminOrderUpdate.tsx`, `wishlist-store.ts`, `sdk.ts`

---

### Step 5 — Inventory Consistency / Preventing Oversell `Intermediate`
**The problem:** `stock_quantity` is never decremented at checkout. Two simultaneous buyers of the last item both succeed — real business loss.

**The solution:** A conditional SQL update (`WHERE stock_quantity >= quantity`) that is atomic. Zero rows returned = out of stock. A `CHECK` constraint as a database-level safety net.

**Interview angle:** "How do you prevent overselling on e-commerce?" — atomic conditional updates, not read-then-write.

**Files changed:** new `reserve-inventory` + `release-inventory` Edge Functions, `CheckoutPage.tsx`, `schema.sql`

---

### Step 6 — Rate Limiting (Token Bucket) `Intermediate`
**The problem:** All Edge Functions accept requests from any caller. A malicious actor can exhaust the Razorpay quota or spam emails at no cost.

**The solution:** A `rate_limits` table + token bucket algorithm shared across Edge Functions. HTTP 429 with `Retry-After` on violation.

**Interview angle:** "What are the four rate limiting algorithms?" — fixed window, sliding window, token bucket, leaky bucket. Token bucket allows burst while enforcing a long-term average.

**Files changed:** `create-razorpay-order/index.ts`, `send-order-email/index.ts`, `schema.sql`, `CheckoutPage.tsx`

---

### Step 7 — Async Job Queue `Intermediate`
**The problem:** Order confirmation email is sent synchronously during checkout — the user waits for a Resend API call before seeing the confirmation page. Email is a side effect, not critical path.

**The solution:** A `pending_jobs` table. After payment, enqueue a job and immediately navigate the user. A scheduled Edge Function processes jobs with retry logic (max 3 attempts).

**Interview angle:** "How does Stripe send webhooks reliably?" — producer/consumer queue, at-least-once delivery, idempotency keys.

**Files changed:** `schema.sql`, `CheckoutPage.tsx`, new `process-jobs` Edge Function, `sdk.ts`

---

### Step 8 — Real-Time Pub/Sub `Intermediate`
**The problem:** The admin order panel requires manual refresh to see new orders. Customers have no live status updates.

**The solution:** Supabase Realtime (Postgres logical replication over WebSocket). Subscribe to `INSERT` events for admins, `UPDATE` events filtered by customer email for customers.

**Interview angle:** "How does Slack deliver messages instantly?" — WebSocket pub/sub, Postgres WAL streaming.

**Files changed:** `AdminOrders.tsx`, `OrderHistoryPage.tsx`, new `realtime.ts`

---

### Step 9 — Structured Observability `Advanced`
**The problem:** `error-tracking.ts` wraps `console.error`. When a payment fails in production, there's no structured way to investigate or alert on it.

**The solution:** Sentry integration with user context and breadcrumbs at each checkout step. Structured JSON logging in Edge Functions. Metrics panel in the admin dashboard.

**Interview angle:** "What are the three pillars of observability?" — logs (what happened), metrics (how often/fast), traces (where time was spent).

**Files changed:** `error-tracking.ts`, `auth-store.ts`, `CheckoutPage.tsx`, `verify-razorpay-payment/index.ts`, `send-order-email/index.ts`

---

### Step 10 — .NET Core Backend (Future) `Advanced`
**The problem (future):** Supabase Edge Functions are Deno-based and stateless. As business logic grows more complex, a dedicated backend with proper dependency injection, middleware pipelines, and per-service databases becomes maintainable and scalable.

**The solution (to be planned):** Introduce a .NET Core backend — either as a monolith or as separate services each with their own database. This sits alongside or replaces the Edge Function layer while the React frontend and Supabase Auth/Storage remain.

**Interview angle:** Monolith vs. microservices trade-offs. When to split. Database-per-service and the challenges of distributed data.

---

## React Native Portability

Each step is deliberately built to be portable:

- `sdk.ts` — pure TypeScript, zero DOM dependencies; works in React Native unchanged
- Zustand stores — cross-platform; only the persist adapter changes (`localStorage` → `AsyncStorage`)
- All backend work (Edge Functions, DB schema) — platform-agnostic; RN calls the same APIs
- UI components — the only layer that needs rebuilding; NativeWind makes Tailwind classes reusable

---

## How to Use These Docs

1. Read the step doc before starting implementation — it explains the concept and the coding patterns
2. Implement the changes (or ask Claude to implement them)
3. Update the Status column in the table above to `Done`
4. Move to the next step
