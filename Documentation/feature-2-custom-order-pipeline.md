# Feature 2 — End-to-End Custom Order Pipeline

## Context

DigitalJems currently has a dead-end custom request flow: customers submit a request, admin responds once, and there's no production tracking. Simultaneously, stock is never decremented at checkout — two buyers of the last item both succeed. This feature fixes both gaps by adding a unified `custom_jobs` pipeline (for both from-scratch designs and made-to-order catalog items), vendor/karigar management, customer-facing milestone tracking, and an atomic stock reservation RPC.

**Owner benefit:** removes the owner from being a manual coordinator — they approve-by-exception instead of relaying every status update between karigar and customer.

---

## Critical Files

| File | Relevant For |
|------|-------------|
| `supabase/schema.sql` | Schema reference — append all new DDL here |
| `src/components/lib/sdk.ts` | All service methods — follow `if (isDev)` pattern |
| `src/components/types/index.ts` | All shared TS types |
| `src/components/pages/CheckoutPage.tsx` | Stock reservation call (line ~120), Razorpay integration (line ~128) |
| `src/components/pages/CartPage.tsx` | Stock hint UI (line 115) |
| `src/components/pages/admin/AdminLayout.tsx` | Nav items (lines 14–19) |
| `src/App.tsx` | Admin routes (lines 125–136), public routes |
| `src/components/pages/admin/AdminCustomRequestDetailPage.tsx` | Add "Promote to Job" button |
| `src/components/pages/admin/AdminCustomRequests.tsx` | Existing custom requests list — link to jobs |

---

## Data Model

### New tables

```sql
-- Karigar / vendor registry
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  reliability_score DECIMAL(3,2) DEFAULT 5.00,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  address JSONB,
  notes TEXT,
  auth_user_id UUID REFERENCES auth.users(id),  -- Phase 5
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vendors_active ON vendors(active);

-- Job number sequence
CREATE SEQUENCE custom_job_seq START 1;

-- Unified custom jobs
CREATE TABLE custom_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_number TEXT UNIQUE NOT NULL,  -- CJ-2026-0001
  source TEXT NOT NULL CHECK (source IN ('custom_request','mto','admin_manual')),
  custom_request_id UUID REFERENCES custom_requests(id),
  product_id UUID REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  vendor_id UUID REFERENCES vendors(id),
  title TEXT NOT NULL,
  specification JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'intake' CHECK (status IN (
    'intake','design','quoted','approved','deposit_pending','in_production',
    'qc','ready_for_dispatch','dispatched','delivered','cancelled','on_hold'
  )),
  deposit_amount DECIMAL(12,2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT FALSE,
  final_amount DECIMAL(12,2) DEFAULT 0,
  final_paid BOOLEAN DEFAULT FALSE,
  estimated_ready_date DATE,
  actual_ready_date DATE,
  tracking_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_custom_jobs_status ON custom_jobs(status);
CREATE INDEX idx_custom_jobs_vendor ON custom_jobs(vendor_id);
CREATE INDEX idx_custom_jobs_customer ON custom_jobs(customer_email);

-- Milestones with photos
CREATE TABLE custom_job_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES custom_jobs(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL CHECK (milestone IN (
    'design_approved','cad_ready','wax_model','casting',
    'stone_setting','finishing','qc','ready'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  photos JSONB NOT NULL DEFAULT '[]',
  note TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  UNIQUE(job_id, milestone)
);
CREATE INDEX idx_milestones_job ON custom_job_milestones(job_id);

-- App-level settings
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Seed: INSERT INTO app_settings VALUES ('mto_default_deposit_pct', '50', NULL, NOW());
```

### Extensions to existing tables

```sql
-- Orders: MTO states + payment split
ALTER TABLE orders ADD COLUMN custom_job_id UUID REFERENCES custom_jobs(id);
ALTER TABLE orders ADD COLUMN payment_split JSONB;
-- payment_split: { deposit: {amount, status, payment_id, paid_at}, final: {amount, status, payment_id, paid_at} }

ALTER TABLE orders DROP CONSTRAINT orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check CHECK (order_status IN (
  'placed','confirmed','processing','shipped','delivered','cancelled','payment_failed',
  'mto_awaiting_deposit','mto_in_production','mto_ready_for_dispatch'
));

-- Products: MTO opt-in
ALTER TABLE products ADD COLUMN allow_mto BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN mto_lead_time_weeks INTEGER DEFAULT 4;
ALTER TABLE products ADD COLUMN mto_deposit_pct DECIMAL(5,2);  -- NULL = global default
```

### Postgres RPCs

```sql
-- Atomic stock reservation (Phase 1)
CREATE OR REPLACE FUNCTION reserve_product_stock(p_product_id UUID, p_qty INT)
RETURNS TABLE(reserved INT, remaining INT, mto_required BOOLEAN) AS $$
DECLARE
  v_stock INT;
  v_allow_mto BOOLEAN;
BEGIN
  SELECT stock_quantity, allow_mto INTO v_stock, v_allow_mto
  FROM products WHERE id = p_product_id FOR UPDATE;

  IF v_stock >= p_qty THEN
    UPDATE products SET stock_quantity = stock_quantity - p_qty WHERE id = p_product_id;
    RETURN QUERY SELECT p_qty, v_stock - p_qty, FALSE;
  ELSIF v_allow_mto THEN
    RETURN QUERY SELECT 0, v_stock, TRUE;
  ELSE
    RAISE EXCEPTION 'Insufficient stock and MTO not allowed';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Release stock on cancellation (Phase 1)
CREATE OR REPLACE FUNCTION release_product_stock(p_product_id UUID, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET stock_quantity = stock_quantity + p_qty WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Resolve MTO deposit percentage (Phase 4)
CREATE OR REPLACE FUNCTION resolve_mto_deposit_pct(p_product_id UUID)
RETURNS DECIMAL AS $$
DECLARE v_pct DECIMAL;
BEGIN
  SELECT mto_deposit_pct INTO v_pct FROM products WHERE id = p_product_id;
  IF v_pct IS NULL THEN
    SELECT (value::text)::decimal INTO v_pct FROM app_settings WHERE key = 'mto_default_deposit_pct';
  END IF;
  RETURN COALESCE(v_pct, 50);
END;
$$ LANGUAGE plpgsql;
```

---

## Types to Add (`src/components/types/index.ts`)

```ts
export type VendorSpecialty = 'casting' | 'stone_setting' | 'polishing' | 'cad' | 'engraving' | 'assembly';

export interface Vendor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  specialties: VendorSpecialty[];
  reliability_score: number;
  active: boolean;
  address?: Record<string, string>;
  notes?: string;
  created_at: string;
}

export type CustomJobStatus =
  | 'intake' | 'design' | 'quoted' | 'approved' | 'deposit_pending'
  | 'in_production' | 'qc' | 'ready_for_dispatch' | 'dispatched'
  | 'delivered' | 'cancelled' | 'on_hold';

export type MilestoneName =
  | 'design_approved' | 'cad_ready' | 'wax_model' | 'casting'
  | 'stone_setting' | 'finishing' | 'qc' | 'ready';

export interface CustomJob {
  id: string;
  job_number: string;
  source: 'custom_request' | 'mto' | 'admin_manual';
  custom_request_id?: string;
  product_id?: string;
  order_id?: string;
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  vendor_id?: string;
  title: string;
  specification: Record<string, unknown>;
  status: CustomJobStatus;
  deposit_amount: number;
  deposit_paid: boolean;
  final_amount: number;
  final_paid: boolean;
  estimated_ready_date?: string;
  actual_ready_date?: string;
  tracking_token: string;
  created_at: string;
  updated_at: string;
}

export interface CustomJobMilestone {
  id: string;
  job_id: string;
  milestone: MilestoneName;
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
  photos: string[];
  note?: string;
  completed_at?: string;
  completed_by?: string;
}

export interface CustomJobDetail extends CustomJob {
  vendor?: Vendor;
  milestones: CustomJobMilestone[];
}

export interface CustomJobPublic {
  id: string;
  job_number: string;
  title: string;
  status: CustomJobStatus;
  estimated_ready_date?: string;
  deposit_amount: number;
  final_amount: number;
  milestones: Pick<CustomJobMilestone, 'milestone' | 'status' | 'photos' | 'completed_at'>[];
}

// Extend existing OrderStatus union:
// 'mto_awaiting_deposit' | 'mto_in_production' | 'mto_ready_for_dispatch'

// Extend AdminActionType:
// 'vendor_created' | 'vendor_updated' | 'job_created' | 'job_status_changed' | 'milestone_updated' | 'mto_converted'
```

---

## Service Methods to Add (`src/components/lib/sdk.ts`)

```ts
// vendorService
list(filter?: { active?: boolean }): Promise<Vendor[]>
get(id: string): Promise<Vendor>
create(input: Omit<Vendor, 'id' | 'reliability_score' | 'created_at'>): Promise<Vendor>
update(id: string, patch: Partial<Vendor>): Promise<Vendor>
archive(id: string): Promise<void>

// customJobService
list(filter: { status?; vendor_id?; source?; q? }): Promise<CustomJob[]>
get(id: string): Promise<CustomJobDetail>
getByToken(token: string): Promise<CustomJobPublic>
createFromRequest(custom_request_id: string, spec: object): Promise<CustomJob>
createMTO(product_id: string, order_id: string, spec: object): Promise<CustomJob>
update(id: string, patch: Partial<CustomJob>): Promise<CustomJob>
assignVendor(id: string, vendor_id: string): Promise<void>
setMilestone(job_id: string, milestone: MilestoneName, patch: { status?; note?; photos? }): Promise<CustomJobMilestone>
uploadMilestonePhoto(job_id: string, milestone: MilestoneName, file: File): Promise<string>

// stockService
reserve(product_id: string, qty: number): Promise<{ reserved: number; remaining: number; mto_required: boolean }>
release(product_id: string, qty: number): Promise<void>

// appSettingsService
get<T>(key: string): Promise<T | null>
set(key: string, value: unknown): Promise<void>
```

All follow the `if (isDev)` pattern. Dev mocks: 3 seeded vendors, `DEV_SETTINGS = { mto_default_deposit_pct: 50 }`, `DEV_JOBS = []`, `stockService.reserve` mutates `DEV_PRODUCTS[i].stock_quantity`.

---

## Phase 1 — Schema + Vendors CRUD + Atomic Stock (M) ✓ Done — [step-01 doc](./feature-2-step-01-schema-vendors-stock.md)

**Goal:** Fix the overselling race condition immediately. Land all schema. Build vendor CRUD UI. Wire `stockService.reserve()` into checkout.

### Files to create
- `supabase/migrations/20260420_10_custom_jobs_schema.sql` — all new tables, RPCs, `app_settings` seed, products/orders alterations
- `src/components/pages/admin/AdminVendors.tsx` — vendor list with search, status badges, archive button
- `src/components/pages/admin/AdminVendorForm.tsx` — vendor create/edit form (name, phone, email, specialties multi-select, notes)

### Files to modify

| File | Change |
|------|--------|
| `supabase/schema.sql` | Append all new DDL (canonical reference) |
| `src/components/types/index.ts` | Add `Vendor`, `VendorSpecialty`; extend `OrderStatus` and `AdminActionType` |
| `src/components/lib/sdk.ts` | Add `vendorService`, `stockService`, `appSettingsService` with dev mocks |
| `src/components/pages/admin/AdminLayout.tsx` lines 14–19 | Add `{ path: "/admin/vendors", icon: Users, label: "Vendors" }` |
| `src/App.tsx` lines 125–136 | Add `<Route path="vendors" element={<AdminVendors />} />`, `<Route path="vendors/new" />`, `<Route path="vendors/:id/edit" />` |
| `src/components/pages/CheckoutPage.tsx` line ~120 | Before `orderService.createOrder()`: call `stockService.reserve(product_id, qty)` for each cart item. On failure or `mto_required=true` with `allow_mto=false`, toast error and abort. On payment failure (line ~137): call `stockService.release()` for each item. |
| `src/components/pages/CartPage.tsx` line 115 | Keep as UX hint only; server-side enforcement is in CheckoutPage |

### Acceptance criteria
- Parallel stock reservation: two sessions each try `qty=3` with `stock=4` → one gets `reserved=3, remaining=1`; second gets 0
- Vendor CRUD round-trips; logs `vendor_created`, `vendor_updated`
- Normal in-stock checkout completes; `products.stock_quantity` decremented
- Payment failure calls `stockService.release()` to restore stock

---

## Phase 2 — Admin Custom Jobs Board (L) ✓ Done — [step-02 doc](./feature-2-step-02-admin-jobs-board.md)

**Goal:** Unified pipeline management UI — kanban + table, vendor assignment, milestone photos, "Promote to Job" on existing custom requests.

### Files to create
- `src/components/pages/admin/AdminCustomJobs.tsx` — kanban (drag between status columns) + table toggle; filter by vendor/source/status; search by customer email
- `src/components/pages/admin/AdminCustomJobDetail.tsx` — job detail: spec view, vendor picker, milestone timeline, deposit/final payment toggles
- `src/components/admin/MilestoneTimeline.tsx` — vertical timeline of all 8 milestones; each shows status + photos + note
- `src/components/admin/MilestoneEditor.tsx` — per-milestone: status dropdown, note input, photo upload (max 5 photos, 10MB each client-side enforced)
- `src/components/admin/JobVendorAssignDialog.tsx` — vendor picker with search + specialties filter

### Files to modify

| File | Change |
|------|--------|
| `src/components/lib/sdk.ts` | Add `customJobService`; dev mocks seed 2 jobs |
| `src/components/types/index.ts` | Add `CustomJob`, `CustomJobDetail`, `CustomJobMilestone`, `MilestoneName`, `CustomJobStatus` |
| `src/App.tsx` lines 125–136 | Add `<Route path="custom-jobs" element={<AdminCustomJobs />} />`, `<Route path="custom-jobs/:id" />` |
| `src/components/pages/admin/AdminLayout.tsx` lines 14–19 | Add `{ path: "/admin/custom-jobs", icon: Hammer, label: "Jobs" }` |
| `src/components/pages/admin/AdminCustomRequestDetailPage.tsx` | Add "Promote to Job" button → `customJobService.createFromRequest(request_id, ...)` → navigate to `/admin/custom-jobs/{id}` |

**Job number:** SQL trigger auto-generates `CJ-YYYY-${padded sequence}` on INSERT.
**Milestone photos:** stored in `images` bucket under `custom-jobs/{job_id}/{milestone}/{timestamp}.ext`. Reuse existing `storageService` patterns.

### Acceptance criteria
- Kanban drag fires `customJobService.update()` and logs `job_status_changed` with before/after
- Photo upload stores CDN URL in `custom_job_milestones.photos` JSONB
- "Promote to Job" creates job with `source='custom_request'`; original request row untouched
- Job number auto-generates in `CJ-YYYY-NNNN` format

---

## Phase 3 — Customer Tracker + Milestone Emails (M)

**Goal:** Public `/track/:token` page (no login). Authenticated `/my-custom-jobs`. DB triggers fire email on status change + milestone completion.

### Files to create
- `src/components/pages/TrackCustomJobPage.tsx` — public; shows milestone photos, estimated date, amounts; hides vendor name and payment IDs
- `src/components/pages/MyCustomJobsPage.tsx` — authenticated; merges unpromoted `custom_requests` + active `custom_jobs`; sorted by `updated_at DESC`
- `src/components/CustomerMilestoneTimeline.tsx` — simplified customer-facing timeline (no edit controls)
- `supabase/functions/custom-job-notify/index.ts` — Resend email with embedded milestone photo on `status_change` / `milestone_completed`
- `supabase/migrations/20260420_12_custom_job_triggers.sql` — `AFTER UPDATE` triggers on `custom_jobs.status` and `custom_job_milestones.status` via `pg_net.http_post`

### Files to modify

| File | Change |
|------|--------|
| `src/App.tsx` | Public `<Route path="/track/:token" element={<TrackCustomJobPage />} />`, authenticated `<Route path="/my-custom-jobs" />` |
| `src/components/lib/sdk.ts` | Add `customJobService.getByToken(token)` — no auth, returns `CustomJobPublic` |
| `src/components/pages/MyCustomRequestsPage.tsx` | If request is promoted, show "View production status →" link to `/track/:token` |

### Acceptance criteria
- `/track/{token}` without login shows milestone photos; hides vendor name and payment_id
- Email arrives within ~30s of milestone marked `done`
- `/my-custom-jobs` shows both unpromoted requests AND active jobs

---

## Phase 4 — Out-of-Stock → MTO Conversion + Deposit Split (L)

**Goal:** `mto_required=true` from `stockService.reserve()` shows MTO dialog, creates job, charges deposit only. Admin triggers final payment separately.

### Files to create
- `src/components/checkout/MTOConfirmDialog.tsx` — dialog showing lead time, deposit amount, final amount, estimated ready date; "Accept MTO" / "Cancel"
- `src/components/admin/FinalInvoiceDialog.tsx` — admin sends final Razorpay payment link to customer
- `supabase/functions/mto-quote/index.ts` — `{ product_id, qty }` → `{ unit_price, deposit_amount, final_amount, lead_weeks }`

### Files to modify

| File | Change |
|------|--------|
| `src/components/pages/CheckoutPage.tsx` | On `mto_required=true`: fetch MTO quote → show `MTOConfirmDialog` → on accept: `customJobService.createMTO()`, create order with `order_status='mto_awaiting_deposit'` and `payment_split` JSONB, charge deposit only via Razorpay |
| `src/components/pages/CartPage.tsx` | Show "Made-to-order eligible" badge where `stock_quantity < qty && allow_mto` |
| `src/components/lib/sdk.ts` | Add `orderService.createMTOOrder()`, `orderService.chargeFinal()` |
| `src/components/pages/admin/AdminOrderDetail.tsx` | Show `payment_split` ledger; "Send final invoice" CTA → `FinalInvoiceDialog` |
| `src/components/pages/admin/AdminCustomJobDetail.tsx` | Surface linked `order_id` + `payment_split` status |
| `src/components/pages/admin/AdminProductForm.tsx` | Add MTO section: `allow_mto` toggle, `mto_lead_time_weeks` input, `mto_deposit_pct` input (empty = global default) |

**MTO payment flow:**
1. Customer accepts → deposit Razorpay order; `order_status = 'mto_awaiting_deposit'`
2. Deposit paid → `order_status = 'mto_in_production'`; `deposit_paid = true` on job
3. Admin "Send final invoice" → Razorpay link emailed to customer
4. Final paid → `order_status = 'mto_ready_for_dispatch'`; `final_paid = true`
5. Admin ships → normal tracking (tracking_number, shipping_provider)

### Acceptance criteria
- `stock_quantity=0, allow_mto=true` at checkout → `MTOConfirmDialog` appears
- Deposit paid → `payment_split.deposit.status = 'paid'`, order status `mto_in_production`
- Final invoice → customer gets Razorpay link; final paid → `mto_ready_for_dispatch`
- `orders.payment_split` JSONB populated at each step

---

## Phase 5 — Vendor Portal + Karigar Scorecards (L)

**Goal:** Vendors log in via magic link, see only their jobs, update milestones directly. Scorecards show on-time % and avg lead time on admin vendors page.

### Files to create
- `src/components/pages/vendor/VendorLayout.tsx` — shell (My Jobs, Profile nav; no admin nav)
- `src/components/pages/vendor/VendorDashboard.tsx` — vendor's assigned jobs by status
- `src/components/pages/vendor/VendorJobDetail.tsx` — milestone editor + photo upload; no customer payment details shown
- `src/components/admin/VendorScorecard.tsx` — jobs_completed, on_time_pct (actual_ready_date ≤ estimated_ready_date), avg_lead_days
- `supabase/migrations/20260420_14_vendor_auth.sql` — RLS: `custom_jobs` WHERE `vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid())`

### Files to modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/vendor/*` route group: `<Route path="/vendor/*" element={<VendorLayout />}>` |
| `src/components/store/auth-store.ts` | Add `vendor` role alongside existing `is_admin` check |
| `src/components/lib/sdk.ts` | Add `vendorService.scorecard(id)`, `customJobService.listForVendor()` |
| `src/components/pages/admin/AdminVendors.tsx` | Embed `VendorScorecard` per row; "Invite vendor" button sends magic link |

### Acceptance criteria
- Vendor sees only their own jobs (RLS enforced)
- Vendor photo upload triggers same email chain as admin upload
- `SELECT * FROM custom_jobs WHERE vendor_id != (my vendor id)` returns 0 rows
- Scorecard computed from job history

---

## Dev Mode Seed Data

```ts
const DEV_VENDORS = [
  { id: 'v1', name: 'Raju Karigar', specialties: ['casting', 'stone_setting'], reliability_score: 4.8, active: true, phone: '9876543210', created_at: new Date().toISOString() },
  { id: 'v2', name: 'Silver Works', specialties: ['polishing', 'finishing'], reliability_score: 4.5, active: true, phone: '9876543211', created_at: new Date().toISOString() },
  { id: 'v3', name: 'CAD Designs', specialties: ['cad'], reliability_score: 4.2, active: true, phone: '9876543212', created_at: new Date().toISOString() },
];
const DEV_SETTINGS = { mto_default_deposit_pct: 50 };
const DEV_JOBS: CustomJob[] = [];  // populated via UI interactions in dev
```

---

## Effort Summary

| Phase | Scope | Effort |
|-------|-------|--------|
| 1 | Schema + vendors + atomic stock | M |
| 2 | Admin jobs board + milestone editor | L |
| 3 | Customer tracker + emails | M |
| 4 | MTO checkout + deposit split | L |
| 5 | Vendor portal + scorecards | L |
