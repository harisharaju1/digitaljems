# Feature 2, Phase 3 — Customer Tracker + Milestone Emails

**Feature:** End-to-End Custom Order Pipeline  
**Status:** Done  
**Difficulty:** M (Medium)

---

## The Problem We're Solving

After Phases 1 and 2, admins can create and manage custom jobs with full milestone tracking. But customers have no visibility into what's happening. They submit a request, get a quoted price, and then... silence. Until the piece is ready.

**Two gaps remain:**

1. **No customer visibility.** Once a request is promoted to a job, the customer can't see production milestones, photos, or an estimated ready date — without calling or messaging the owner.

2. **No proactive notifications.** When a milestone is completed (casting done, stone-setting done, ready for dispatch), the admin must manually message the customer. This is exactly the coordination overhead the feature is supposed to remove.

This phase adds a public tracking URL (no login needed), an authenticated "My Jobs" page, and automatic milestone notification emails fired by Postgres triggers.

---

## The Solution

### 1. Public tracking token

Each `custom_job` row has a `tracking_token` (a random 16-byte hex string, collision-resistant). The admin can share `/track/{token}` with the customer. This page shows production progress without requiring a login — which matters because many B2B and retail customers won't have accounts.

The endpoint returns a **redacted view** (`CustomJobPublic`): milestone photos and estimated dates are visible; vendor name and payment IDs are not. This is enforced in `customJobService.getByToken()` at the query layer — the Supabase select only pulls the safe columns.

### 2. Authenticated "My Jobs" page

Logged-in customers get `/my-custom-jobs`, which merges:
- Active `custom_jobs` linked to their email
- Unpromoted `custom_requests` (not yet turned into a job)

Promoted requests (those with a corresponding `custom_job.custom_request_id`) show a "View production status →" link to `/track/{token}` instead of the old static view.

### 3. DB trigger → edge function notifications

A Postgres trigger fires `AFTER UPDATE` on both `custom_jobs.status` and `custom_job_milestones.status`. It calls the `custom-job-notify` Deno edge function via `pg_net.http_post`. The edge function loads the job + customer info and sends a Resend email with the milestone photo embedded.

```
Admin marks milestone "done"
  → AFTER UPDATE trigger fires on custom_job_milestones
  → pg_net.http_post → custom-job-notify edge function
  → Resend API → customer email (with photo)
  → Customer clicks link to /track/{token}
```

---

## Key Concepts

### Public routes without auth guards

`TrackCustomJobPage` is registered under the customer `<Routes>` block with no auth guard — unlike `MyCustomJobsPage`, which redirects to `/login` if the user isn't authenticated. The distinction is intentional: tracking links are shared over WhatsApp and email and need to work without accounts.

### Postgres trigger + pg_net

`pg_net` is a Supabase extension that lets SQL triggers make HTTP calls. The trigger runs inside the same transaction as the milestone update, but `pg_net.http_post` is non-blocking — the HTTP call is enqueued, and the trigger returns immediately. This means the notification is eventually consistent (fires within seconds) but doesn't block the admin's write.

```sql
-- CONCEPT: AFTER UPDATE trigger fires once the row change commits
CREATE OR REPLACE FUNCTION notify_job_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- CONCEPT: pg_net.http_post — async HTTP call, non-blocking
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/custom-job-notify',
    ...
  );
  RETURN NEW;
END;
$$;
```

### Redacted public view

`customJobService.getByToken()` selects only `milestone, status, photos, completed_at` from `custom_job_milestones` — not `completed_by` (vendor name). The `CustomJobPublic` type enforces this at compile time: any component that receives `CustomJobPublic` cannot access fields that weren't fetched.

---

## Coding Concepts Used

| Concept | What it is | Where it appears |
|---------|-----------|-----------------|
| **Public route (no auth guard)** | Route visible without login — no `useEffect` redirect | `TrackCustomJobPage` |
| **`useParams`** | React Router hook that extracts URL segments (`/track/:token` → `{ token }`) | `TrackCustomJobPage` |
| **Discriminated union for merged list** | `{ kind: 'job'; data: CustomJob } \| { kind: 'request'; data: CustomRequest }` — the `kind` field tells the renderer which type it has | `MyCustomJobsPage` |
| **Set for O(1) lookup** | `new Set(promotedIds)` — checking "is this request promoted?" is O(1) not O(N) | `MyCustomJobsPage` |
| **Postgres AFTER UPDATE trigger** | Fires once per row after a committed update; cannot roll back the update | `custom_job_triggers.sql` |
| **pg_net.http_post** | Non-blocking async HTTP from SQL — returns a job ID, not the response | trigger function |
| **current_setting()** | Reads a Postgres run-time parameter set via `ALTER DATABASE ... SET app.settings.X` | trigger function |
| **Deno serve()** | Entry point for Supabase Edge Functions — receives `Request`, returns `Response` | `custom-job-notify` |
| **CORS preflight** | OPTIONS response required by browsers before cross-origin POSTs | `custom-job-notify` |

---

## Changes Made

### 1. New: `src/components/CustomerMilestoneTimeline.tsx`

Reusable customer-facing timeline. Takes the array of milestones from `CustomJobPublic` and renders them in fixed order (design_approved → ready). Each completed milestone shows its first photo.

```tsx
// CONCEPT: ordered constant — milestone order is fixed regardless of DB insertion order
const MILESTONE_ORDER: MilestoneName[] = [
  "design_approved", "cad_ready", "wax_model", "casting",
  "stone_setting", "finishing", "qc", "ready",
];

// CONCEPT: Map for O(1) lookup — build once at render time,
// look up by milestone name in the render loop
const byName = new Map(milestones.map(m => [m.milestone, m]));

{MILESTONE_ORDER.map((name, idx) => {
  const m = byName.get(name); // O(1) — no nested .find() in a loop
  const status = m?.status ?? "pending";
  ...
})}
```

### 2. New: `src/components/pages/TrackCustomJobPage.tsx`

Public page. Calls `customJobService.getByToken(token)` which requires no authentication — it hits the `custom_jobs` table filtered by `tracking_token`, selecting only the public columns.

```tsx
// CONCEPT: useParams — React Router extracts URL segments as an object
const { token } = useParams<{ token: string }>();

useEffect(() => {
  if (!token) return;
  customJobService.getByToken(token)  // no auth header needed
    .then(setJob)
    .catch(() => setError("Invalid or expired tracking link."));
}, [token]);
```

### 3. New: `src/components/pages/MyCustomJobsPage.tsx`

Authenticated page. Loads both custom_requests and custom_jobs in parallel, merges them.

```tsx
// CONCEPT: Promise.all — run two independent async operations concurrently
const [jobs, requests] = await Promise.all([
  customJobService.listForCustomer(user.email),
  customRequestService.getMyRequests(user.email),
]);

// CONCEPT: Set for O(1) promoted-request lookup
const promotedIds = new Set(
  jobs
    .filter(j => j.custom_request_id)
    .map(j => j.custom_request_id!)
);

// Unpromoted requests only — the rest show via their custom_job entry
const unpromoted = requests.filter(r => !promotedIds.has(r.id));
```

### 4. sdk.ts — add `listForCustomer` to `customJobService`

Fetches jobs filtered by customer email (not admin-scoped).

```ts
async listForCustomer(email: string): Promise<CustomJob[]> {
  if (isDev) {
    // CONCEPT: DEV_JOBS is the in-memory store; filter by email for the dev customer
    return DEV_JOBS
      .map(({ vendor: _v, milestones: _m, ...j }) => j as CustomJob)
      .filter(j => j.customer_email === email)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  const { data, error } = await supabase
    .from("custom_jobs")
    .select("*")
    .eq("customer_email", email)  // CONCEPT: customer-scoped query — not admin-wide
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CustomJob[];
},
```

### 5. Modified: `src/components/pages/MyCustomRequestsPage.tsx`

After loading requests, also load promoted job tokens and show a tracking link.

```tsx
// Also load promoted jobs to find tracking tokens
const jobs = await customJobService.listForCustomer(user.email);
const promotedMap = new Map(
  jobs
    .filter(j => j.custom_request_id)
    .map(j => [j.custom_request_id!, j.tracking_token])
);

// In the request card render:
{promotedMap.has(request.id) && (
  // CONCEPT: Link to public tracker — works even if customer shares with someone else
  <Button asChild variant="outline" size="sm">
    <Link to={`/track/${promotedMap.get(request.id)}`}>
      View production status →
    </Link>
  </Button>
)}
```

### 6. New: `supabase/functions/custom-job-notify/index.ts`

Edge function. Invoked by DB trigger. Loads job + milestone context, sends Resend email.

```ts
// CONCEPT: serve() — Deno's HTTP server entry point for Supabase Edge Functions
serve(async (req) => {
  if (req.method === "OPTIONS") {
    // CONCEPT: CORS preflight — browser sends OPTIONS first for cross-origin requests
    return new Response("ok", { headers: corsHeaders });
  }

  const { job_id, event } = await req.json();
  // Load job with milestones to get customer email + latest photos
  const { data: job } = await supabaseAdmin
    .from("custom_jobs")
    .select("*, custom_job_milestones(*)")
    .eq("id", job_id).single();

  // Send via Resend
  await fetch("https://api.resend.com/emails", { ... });
});
```

### 7. New: `supabase/migrations/20260420_12_custom_job_triggers.sql`

```sql
-- CONCEPT: pg_net extension — enables async HTTP from SQL
CREATE EXTENSION IF NOT EXISTS pg_net;

-- CONCEPT: trigger function — reusable, attached to multiple tables below
CREATE OR REPLACE FUNCTION notify_custom_job_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_job_id UUID;
BEGIN
  -- Determine job_id regardless of which table triggered this
  v_job_id := CASE TG_TABLE_NAME
    WHEN 'custom_jobs' THEN NEW.id
    ELSE NEW.job_id
  END;

  -- CONCEPT: pg_net.http_post — fires and forgets; doesn't block the UPDATE
  PERFORM net.http_post(
    url    := current_setting('app.settings.supabase_url') || '/functions/v1/custom-job-notify',
    body   := json_build_object('job_id', v_job_id, 'event',
               CASE TG_TABLE_NAME WHEN 'custom_jobs' THEN 'status_change' ELSE 'milestone_completed' END
             )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )::jsonb
  );
  RETURN NEW;
END;
$$;

-- Trigger on job status changes
CREATE TRIGGER trg_custom_job_status_notify
  AFTER UPDATE OF status ON custom_jobs
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_custom_job_update();

-- Trigger on milestone completions
CREATE TRIGGER trg_milestone_status_notify
  AFTER UPDATE OF status ON custom_job_milestones
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done')
  EXECUTE FUNCTION notify_custom_job_update();
```

### 8. Modified: `src/App.tsx`

Added two routes inside the customer `<Routes>` block.

### 9. Modified: `Documentation/feature-2-custom-order-pipeline.md`

Updated Phase 3 status to Done.

---

## What You'll Learn Building This

| Concept | Why It Matters |
|---------|---------------|
| Public vs. authenticated routes | Not every page needs a login — sharing a tracking URL over WhatsApp is a real UX pattern |
| Postgres AFTER UPDATE triggers | DB-driven side effects are reliable — they fire even if the API call that triggered the write never sends a notification |
| pg_net async HTTP | You can call external services from SQL without blocking the transaction |
| Redacted query layer | Selecting fewer columns at the DB layer is more reliable than filtering in JS — the field simply doesn't exist in the response |
| Promise.all for parallel loads | Two independent async operations should run concurrently, not sequentially |

---

## Interview Answer

> "The customer tracker uses a public tokenized URL — no login required — backed by a Postgres query that selects only the safe columns (photos, milestone status, estimated date) and explicitly excludes sensitive fields like vendor name and payment IDs. Notifications fire via a Postgres `AFTER UPDATE` trigger that calls `pg_net.http_post`, which is non-blocking — the trigger enqueues the HTTP call and returns immediately so the admin's milestone update isn't delayed by email delivery. This is at-least-once delivery: if the edge function crashes, the DB write still committed, so the worst case is a missed notification rather than a failed update."

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/CustomerMilestoneTimeline.tsx` | New — customer-facing milestone timeline (no edit controls) |
| `src/components/pages/TrackCustomJobPage.tsx` | New — public tracking page at `/track/:token` |
| `src/components/pages/MyCustomJobsPage.tsx` | New — authenticated merged jobs + requests page |
| `supabase/functions/custom-job-notify/index.ts` | New — Resend email edge function |
| `supabase/migrations/20260420_12_custom_job_triggers.sql` | New — AFTER UPDATE triggers |
| `src/components/lib/sdk.ts` | Add `customJobService.listForCustomer(email)` |
| `src/components/pages/MyCustomRequestsPage.tsx` | Add promoted-request tracking link |
| `src/App.tsx` | Add `/track/:token` and `/my-custom-jobs` routes |
| `Documentation/feature-2-custom-order-pipeline.md` | Phase 3 status → Done |
