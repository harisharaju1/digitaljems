# Feature 2, Phase 2 — Admin Custom Jobs Board

**Feature:** End-to-End Custom Order Pipeline  
**Status:** Done  
**Difficulty:** L (Large)

---

## The Problem We're Solving

After Phase 1, custom requests are a dead-end: admin responds once, the conversation stops. There's no way to:
- Track a job through the physical production pipeline (design → casting → polishing → QC)
- Know which karigar (vendor) is working on a piece at any moment
- See all in-flight jobs in one view
- Attach milestone photos to show the customer progress

Phase 2 builds the admin-facing production management system: a kanban board where jobs move through statuses, a milestone timeline per job, and vendor assignment.

---

## Why a Kanban Board (Not Just a Table)

A table shows all jobs simultaneously — useful for searching, but it doesn't communicate flow. Production pipelines are fundamentally about movement: a job sitting in "casting" for 10 days is a signal you miss in a static table.

A kanban board exposes WIP (Work-In-Progress) naturally:
- Columns with many cards → bottlenecks
- Empty columns → no work in that stage
- Old card dates → stale jobs

The implementation uses a **table toggle** alongside the kanban for cases where you need to bulk-search or compare across all statuses.

---

## Key Concepts

### HTML5 Drag-and-Drop
No extra library needed — browsers implement DnD natively via three events:

```tsx
// The draggable card
<div
  draggable
  onDragStart={e => {
    e.dataTransfer.setData("jobId", job.id); // store what's being dragged
    setDragJobId(job.id);
  }}
>

// The drop target (column)
<div
  onDragOver={e => e.preventDefault()} // CONCEPT: must call preventDefault() or onDrop won't fire
  onDrop={e => {
    const jobId = e.dataTransfer.getData("jobId"); // retrieve what was dragged
    handleDrop(targetStatus);
  }}
>
```

`e.preventDefault()` in `onDragOver` tells the browser "this element accepts drops". Without it, the cursor shows the "not allowed" icon and `onDrop` never fires.

### Optimistic Update
The status change is applied to local state _before_ the API call completes:

```typescript
async function handleDrop(targetStatus: CustomJobStatus) {
  const prevStatus = job.status;
  // CONCEPT: optimistic update — update UI immediately so the drag feels instant
  setJobs(prev => prev.map(j => j.id === dragJobId ? { ...j, status: targetStatus } : j));

  try {
    await customJobService.update(dragJobId, { status: targetStatus });
    await adminLogService.logAction("job_status_changed", ...);
  } catch {
    // CONCEPT: rollback — if the server rejects the change, revert to the old state
    setJobs(prev => prev.map(j => j.id === dragJobId ? { ...j, status: prevStatus } : j));
    toast({ title: "Failed to update job status" });
  }
}
```

This pattern is also used for vendor assignment and payment toggle in `AdminCustomJobDetail`.

### Milestone Timeline
Eight fixed milestones (design → casting → polishing → QC → ready) are rendered as a vertical timeline. Each milestone shows:
- Status icon (✓ done, ⏱ in-progress, ○ pending, ⤵ skipped)
- Photos attached by the admin or vendor
- Note text
- Completed timestamp + who completed it

The timeline uses **controlled inline expansion**: clicking "Edit" on a milestone expands a `MilestoneEditor` inline (not a modal), keeping context visible.

### Photo Upload (Client-Side Validation)
Validation happens before uploading — no server round-trip needed for size/count checks:

```typescript
if (photos.length + files.length > MAX_PHOTOS) {  // count check
  toast({ title: "Maximum 5 photos per milestone" }); return;
}
for (const file of files) {
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {  // 10MB size check
    toast({ title: `${file.name} exceeds 10MB limit` }); return;
  }
}
```

In production, photos are stored in the `images` Supabase bucket under `custom-jobs/{job_id}/{milestone}/{timestamp}.ext`, returning a public CDN URL stored in `custom_job_milestones.photos` JSONB.

### "Promote to Job" Pattern
When an admin clicks "Promote to Job" on a custom request, the original `custom_requests` row is left untouched — a new `custom_jobs` row is created with `source='custom_request'` and `custom_request_id` pointing back:

```typescript
const job = await customJobService.createFromRequest(request.id, {
  title: request.description.slice(0, 80),
  customer_email: request.customer_email,
  // ...
});
// custom_requests row: unchanged
// custom_jobs row: new, custom_request_id = request.id
```

This preserves the audit trail and lets admins still view the original request alongside the job.

---

## Coding Concepts Used

| Concept | What it is | Where it appears |
|---------|-----------|-----------------|
| **HTML5 DnD** | Native `draggable` + `onDragStart` / `onDragOver` / `onDrop` events | Kanban cards and columns |
| **`e.preventDefault()` in DnD** | Required in `onDragOver` to signal the column accepts drops | `AdminCustomJobs` column divs |
| **`dataTransfer.setData/getData`** | Stores and retrieves arbitrary data across drag events | Job ID passed through drag |
| **Optimistic update** | Apply state change before async confirmation; rollback on failure | Job status drag, payment toggle |
| **Inline expand pattern** | Expand a form inline instead of opening a modal — keeps context visible | `MilestoneTimeline` + `MilestoneEditor` |
| **Client-side file validation** | Check size/count before uploading to avoid unnecessary requests | `MilestoneEditor` photo upload |
| **Controlled details element** | `<details>/<summary>` for "Closed / On Hold" collapsible section | `AdminCustomJobs` footer |
| **`Pick<T, keys>`** | TypeScript utility that creates a subset type — used for `CustomJobPublic.milestones` | `types/index.ts` |
| **`extends` interface** | `CustomJobDetail extends CustomJob` adds `vendor` and `milestones` without repeating fields | `types/index.ts` |

---

## Changes Made

### 1. `src/components/types/index.ts` — new types

```typescript
export type CustomJobStatus =
  | "intake" | "design" | "quoted" | "approved" | "deposit_pending"
  | "in_production" | "qc" | "ready_for_dispatch" | "dispatched"
  | "delivered" | "cancelled" | "on_hold";

export type MilestoneName =
  | "design_approved" | "cad_ready" | "wax_model" | "casting"
  | "stone_setting" | "finishing" | "qc" | "ready";

export interface CustomJob { ... }   // 17 fields
export interface CustomJobMilestone { ... }  // 8 fields, photos: string[]
export interface CustomJobDetail extends CustomJob {
  vendor?: Vendor;
  milestones: CustomJobMilestone[];  // CONCEPT: extends — adds fields without duplicating
}
export interface CustomJobPublic {   // customer-facing subset (hides vendor + payment IDs)
  milestones: Pick<CustomJobMilestone, "milestone" | "status" | "photos" | "completed_at">[];
}
```

Also extended `AdminActionType` with `"job_created"`, `"job_status_changed"`, `"milestone_updated"` and `AdminLog.entity_type` with `"job" | "milestone"`.

---

### 2. `src/components/lib/sdk.ts` — `customJobService` + DEV_JOBS

**DEV_JOBS** seeds 2 jobs: one in `in_production` (3 milestones done), one in `design` (first milestone in-progress).

**`customJobService.list(filter?)`** — filter by status, vendor_id, source, search string.

**`customJobService.setMilestone(job_id, milestone, patch)`:**
```typescript
async setMilestone(job_id, milestone, patch) {
  // Dev: mutate DEV_JOBS[idx].milestones in-place
  // Prod: upsert into custom_job_milestones (job_id, milestone is the unique key)
  const { data, error } = await supabase.from("custom_job_milestones")
    .upsert({ job_id, milestone, ...updates }, { onConflict: "job_id,milestone" })
    .select().single();
}
```

`upsert` with `onConflict: "job_id,milestone"` means: INSERT if the row doesn't exist, UPDATE if it does — keyed on the composite unique constraint defined in the schema.

---

### 3. Kanban Board — `AdminCustomJobs.tsx`

7 grouped columns. Drag fires `handleDrop(targetStatus)` which optimistically updates then calls `customJobService.update()` + admin log. Cancelled/on-hold jobs shown in a collapsed `<details>` footer.

---

### 4. Job Detail — `AdminCustomJobDetail.tsx`

Three-column layout: customer/vendor/payments (left), spec + milestone timeline (right). Status change via dropdown (same optimistic update pattern as drag). Vendor assignment opens `JobVendorAssignDialog`. Payment toggles call `customJobService.update()` directly.

---

### 5. `AdminCustomRequestDetailPage.tsx` — Promote to Job button

Added inline button in the header. On click: calls `customJobService.createFromRequest(request.id, {...})`, logs `job_created`, navigates to the new job.

---

## What You'll Learn

| Concept | Why It Matters |
|---------|---------------|
| HTML5 DnD API | No-library drag-and-drop; ships in every browser. Understanding the three events covers 80% of DnD use cases. |
| Optimistic updates | The UX pattern that makes apps feel instant. The key insight: always keep the rollback value before mutating. |
| Kanban as WIP visualization | Columns reveal bottlenecks that a table hides. Column width limits (WIP limits) are the core of Kanban methodology. |
| Composite upsert | `onConflict` with multiple columns is how you implement "insert or update by compound key" in Postgres. |
| Interface extension vs. composition | `extends` reuses a type without repeating it; useful when the extra fields only make sense in a specific context (e.g. admin detail view). |

---

## Interview Answer

> "The jobs board uses HTML5 drag-and-drop — no library needed. Each card has `draggable=true` and stores the job ID in `dataTransfer` on dragstart; each column calls `preventDefault()` in `onDragOver` (required to accept drops) and reads the ID back in `onDrop`. Status updates are optimistic: the UI state changes immediately and the API call confirms in the background — if it fails, we roll back to the previous status. Milestones use an inline expand pattern rather than a modal so the admin can see the full job context while editing. Photos are validated client-side before upload (count ≤ 5, size ≤ 10MB) and stored in Supabase Storage under `custom-jobs/{job_id}/{milestone}/{timestamp}`."

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/types/index.ts` | Added `CustomJobStatus`, `MilestoneName`, `CustomJob`, `CustomJobMilestone`, `CustomJobDetail`, `CustomJobPublic`; extended `AdminActionType` and `AdminLog.entity_type` |
| `src/components/lib/sdk.ts` | Added `DEV_JOBS` (2 seeded), `customJobService` (9 methods) |
| `src/components/pages/admin/AdminLayout.tsx` | Added Jobs nav item with Hammer icon |
| `src/App.tsx` | Added `custom-jobs` and `custom-jobs/:id` routes |
| `src/components/pages/admin/AdminCustomRequestDetailPage.tsx` | Added "Promote to Job" button with inline handler |
| `src/components/admin/MilestoneTimeline.tsx` | Created — vertical timeline of 8 milestones with inline edit |
| `src/components/admin/MilestoneEditor.tsx` | Created — inline status/note/photo editor per milestone |
| `src/components/admin/JobVendorAssignDialog.tsx` | Created — vendor picker dialog with search + specialty filter |
| `src/components/pages/admin/AdminCustomJobs.tsx` | Created — kanban + table toggle with drag-and-drop |
| `src/components/pages/admin/AdminCustomJobDetail.tsx` | Created — job detail with vendor assign, milestone timeline, payment toggles |
