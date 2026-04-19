# Three B2B Automation Feature Plans — DigitalJems

## Context

DigitalJems is a React + TypeScript + Vite + Supabase jewellery e-commerce SPA. The owner currently operates as a manual switchboard between karigars, vendors, B2B wholesale buyers, retail customers, and marketing channels. This document specifies three independent feature plans, each designed to remove the owner from the default execution path and make them approve-by-exception instead of doing work by default.

Each feature is delivered in 5 phases so it can be shipped incrementally — Phase 1 always delivers the data model + minimal surface, later phases layer capability on top without breaking earlier work. Phases are independent commitment points; stopping after any phase still leaves a working product.

**Stack touchpoints relevant to every plan**
- All backend calls route through `src/components/lib/sdk.ts` service objects
- Every new service method must include an `if (isDev) { ... }` branch so the dev-mode mock flow (`VITE_DEV_MODE=true`) keeps working
- Admin nav items added in `src/components/pages/admin/AdminLayout.tsx` (lines 14–19)
- Admin routes registered in `src/App.tsx` (lines 125–136)
- Types in `src/components/types/index.ts`
- Schema in `supabase/schema.sql`; migrations as new files under `supabase/migrations/`
- Toast pattern: `const { toast } = useToast()` from `src/components/hooks/use-toast.tsx`
- Admin audit log: `await adminLogService.logAction(actionType, entityType, entityId, {...})`
- Product cache invalidation: `cache.invalidateByPrefix('products')`
- Product images and videos are full HTTPS URLs from Supabase Storage (bucket `product-images`)

**User decisions locked in (from planning Q&A)**
- Feature 1: Launch with **manual rate entry only**; pluggable provider stubs added in Phase 3
- Feature 1: Formula must support **both** GST-inclusive and pre-GST modes via a `gst_inclusive` flag on the formula row (final decision deferred to Phase 2)
- Feature 2: MTO deposit policy is **global default + per-product override** → requires a lightweight `app_settings` table and a per-product `mto_deposit_pct` column
- Feature 3: Pilot channel in Phase 3 is **Meta Catalog** (powers Instagram Shopping, Facebook Shop, and WhatsApp Catalog)

---

# Feature 1 — Gold Rate Auto-Pricing

## Objective

Replace daily manual product-price edits with a formula-driven system. Admin sets a one-time pricing formula per product (labor cost/gram, making-charge %, stone cost, GST %, MRP markup %). The system recomputes `price` and `mrp` whenever the metal rate changes. Rates come from a pluggable provider (manual entry at launch; external feed stubs in Phase 3). Every recalc is audit-logged. Phase 4 unlocks B2B rate-locked quotes; Phase 5 adds customer-facing freshness UI.

## Data Model

### New tables

```sql
-- Current + historical metal rates per (type, purity) pair
CREATE TABLE metal_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metal_type TEXT NOT NULL CHECK (metal_type IN ('gold','silver','platinum','white_gold','rose_gold')),
  metal_purity TEXT NOT NULL CHECK (metal_purity IN ('24k','22k','18k','14k','925_silver','950_platinum')),
  rate_per_gram DECIMAL(12,4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  source TEXT NOT NULL CHECK (source IN ('manual','ibja','goldapi','metals_api','mock')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by TEXT  -- admin email for manual entries
);
CREATE UNIQUE INDEX idx_metal_rates_current
  ON metal_rates(metal_type, metal_purity) WHERE is_current = TRUE;
CREATE INDEX idx_metal_rates_fetched_at ON metal_rates(fetched_at DESC);

-- Per-product formula
CREATE TABLE product_pricing_formula (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  auto_price_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  labor_cost_per_gram DECIMAL(10,2) NOT NULL DEFAULT 0,
  making_charges_pct DECIMAL(6,3) NOT NULL DEFAULT 0,
  stone_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_pct DECIMAL(6,3) NOT NULL DEFAULT 3.000,
  gst_inclusive BOOLEAN NOT NULL DEFAULT TRUE,  -- decision deferred to Phase 2
  mrp_markup_pct DECIMAL(6,3) NOT NULL DEFAULT 20.000,
  override_until TIMESTAMPTZ,  -- temporarily suspends auto-recalc (e.g. promo period)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trail: every recalc logs old vs new
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price DECIMAL(12,2),
  new_price DECIMAL(12,2) NOT NULL,
  old_mrp DECIMAL(12,2),
  new_mrp DECIMAL(12,2) NOT NULL,
  rate_id UUID REFERENCES metal_rates(id),
  trigger TEXT NOT NULL CHECK (trigger IN ('rate_refresh','formula_change','manual','initial')),
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_price_history_product ON product_price_history(product_id, computed_at DESC);

-- B2B rate-locked quotes (Phase 4)
CREATE TABLE rate_locked_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,  -- public shareable token
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  items JSONB NOT NULL,  -- [{product_id, qty, locked_price, locked_rate_id, product_snapshot}]
  subtotal DECIMAL(12,2) NOT NULL,
  locked_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','converted','cancelled')),
  converted_order_id UUID REFERENCES orders(id),
  created_by TEXT,  -- admin email
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Non-breaking column on `products`

```sql
ALTER TABLE products
  ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'manual'
  CHECK (pricing_mode IN ('manual','auto'));
```
Existing queries continue to work; only the formula table knows whether auto-pricing is active.

### Postgres RPCs

- `recalc_product_price(p_product_id UUID, p_trigger TEXT) RETURNS TABLE(product_id UUID, new_price DECIMAL, new_mrp DECIMAL)` — computes new price using the formula and the current `metal_rates` row; writes a `product_price_history` entry; updates `products.price` and `products.mrp` atomically.
- `recalc_all_auto_priced_products(p_trigger TEXT) RETURNS INTEGER` — iterates all `product_pricing_formula` rows where `auto_price_enabled=TRUE` and `override_until IS NULL OR override_until < NOW()`. Advisory lock per product_id hash to avoid stampedes.

### Formula (implemented in SQL so rounding is authoritative)

```
weight = products.weight_grams
rate   = metal_rates.rate_per_gram  (current, matched by metal_type + metal_purity)
base   = weight * rate + labor_cost_per_gram * weight + stone_cost
making = base * making_charges_pct / 100
subtotal = base + making

IF gst_inclusive:
  price = subtotal * (1 + gst_pct/100)
ELSE:
  price = subtotal   -- GST shown separately at checkout

mrp = price * (1 + mrp_markup_pct / 100)
```

`making_charges_saved` continues to be derived as `mrp - price` (matches `AdminProductForm.tsx:347` convention).

## Service Layer (`src/components/lib/sdk.ts`)

```ts
export const metalRateService = {
  listCurrent(): Promise<MetalRate[]>;
  listHistory(metal_type: MetalType, metal_purity: MetalPurity, sinceISO: string): Promise<MetalRate[]>;
  setManualRate(input: { metal_type; metal_purity; rate_per_gram; notes? }): Promise<MetalRate>;
  refreshNow(): Promise<{ updated: number; ratesInserted: number }>;  // Phase 3: calls edge fn
};

export const pricingFormulaService = {
  get(product_id: string): Promise<ProductPricingFormula | null>;
  upsert(product_id: string, formula: Partial<ProductPricingFormula>): Promise<ProductPricingFormula>;
  enableAuto(product_id: string, enable: boolean): Promise<void>;
  previewPrice(product_id: string, formula: Partial<ProductPricingFormula>):
    Promise<{ price: number; mrp: number; breakdown: PriceBreakdown }>;
  recalc(product_id: string, trigger: PriceTrigger): Promise<{ price: number; mrp: number }>;
  recalcAll(trigger: PriceTrigger): Promise<{ count: number }>;
  history(product_id: string, limit?: number): Promise<ProductPriceHistory[]>;
};

export const rateLockedQuoteService = {  // Phase 4
  create(items: QuoteItem[], lockedHours: 24 | 48 | 72, customer: QuoteCustomer): Promise<RateLockedQuote>;
  get(token: string): Promise<RateLockedQuote>;
  listByAdmin(): Promise<RateLockedQuote[]>;
  convertToOrder(token: string): Promise<Order>;
  cancel(id: string): Promise<void>;
};
```

All four services follow the existing `if (isDev)` pattern. Dev mocks seed one current rate per (metal_type, metal_purity) pair and one formula row per existing `DEV_PRODUCTS` entry so the admin UI renders identically offline.

## Edge Functions

- `supabase/functions/refresh-metal-rates/index.ts` (Phase 3)
  - Trigger: Supabase scheduled cron every 30 min during market hours, plus manual POST from admin
  - Input: `{ force?: boolean; provider?: 'manual' | 'ibja' | 'goldapi' | 'mock' }` (service-role JWT required)
  - Calls the provider adapter under `_shared/rateProviders/`, inserts new `metal_rates` rows, flips `is_current` atomically, invokes `recalc_all_auto_priced_products('rate_refresh')`, returns `{ ratesInserted, productsUpdated }`
- `supabase/functions/_shared/rateProviders/` (Phase 3)
  - `index.ts` — registry, picks provider by `Deno.env.get('METAL_RATE_PROVIDER')`
  - `manual.ts` — no-op, used when admin-only
  - `mock.ts` — deterministic rates for dev
  - `ibja.ts`, `goldapi.ts`, `metals_api.ts` — stubs with signature `fetchRates(): Promise<RateRow[]>`, implementation deferred (skeletons only in Phase 3)
- `supabase/functions/expire-rate-quotes/index.ts` (Phase 4) — daily cron, flips `status` from `active` to `expired` where `locked_until < NOW()`

## Types (`src/components/types/index.ts`)

```ts
export type MetalType = 'gold' | 'silver' | 'platinum' | 'white_gold' | 'rose_gold';
export type MetalPurity = '24k' | '22k' | '18k' | '14k' | '925_silver' | '950_platinum';
export type PriceTrigger = 'rate_refresh' | 'formula_change' | 'manual' | 'initial';
export type RateSource = 'manual' | 'ibja' | 'goldapi' | 'metals_api' | 'mock';

export interface MetalRate {
  id: string;
  metal_type: MetalType;
  metal_purity: MetalPurity;
  rate_per_gram: number;
  currency: 'INR';
  source: RateSource;
  fetched_at: string;
  is_current: boolean;
  notes?: string;
  created_by?: string;
}

export interface ProductPricingFormula {
  product_id: string;
  auto_price_enabled: boolean;
  labor_cost_per_gram: number;
  making_charges_pct: number;
  stone_cost: number;
  gst_pct: number;
  gst_inclusive: boolean;
  mrp_markup_pct: number;
  override_until?: string;
  updated_at: string;
}

export interface ProductPriceHistory {
  id: string;
  product_id: string;
  old_price?: number;
  new_price: number;
  old_mrp?: number;
  new_mrp: number;
  rate_id?: string;
  trigger: PriceTrigger;
  computed_at: string;
}

export interface PriceBreakdown {
  weight_grams: number;
  rate_per_gram: number;
  metal_cost: number;
  labor_cost: number;
  stone_cost: number;
  making_charges: number;
  gst_amount: number;
  price: number;
  mrp: number;
}

export interface QuoteItem {
  product_id: string;
  qty: number;
  locked_price: number;
  locked_rate_id: string;
  product_snapshot: Pick<Product, 'name' | 'images' | 'weight_grams'>;
}

export interface RateLockedQuote {
  id: string;
  token: string;
  customer_email: string;
  customer_name?: string;
  items: QuoteItem[];
  subtotal: number;
  locked_until: string;
  status: 'active' | 'expired' | 'converted' | 'cancelled';
  converted_order_id?: string;
  created_by: string;
  created_at: string;
}
```

Extend `AdminActionType` with: `'rate_set_manual' | 'rate_refreshed' | 'formula_updated' | 'auto_price_toggled' | 'quote_created' | 'quote_converted' | 'quote_cancelled'`.

## UI Additions

| File | Purpose | Phase |
|------|---------|-------|
| `src/components/pages/admin/AdminMetalRates.tsx` | Landing page; table of current rates, manual-entry dialog, "Refresh now" button (Phase 3+) | 1 |
| `src/components/admin/ManualRateDialog.tsx` | Modal for inserting manual rate, with validation | 1 |
| `src/components/admin/PricingFormulaSection.tsx` | Embedded inside `AdminProductForm.tsx` after pricing inputs — Switch toggle + formula inputs + computed preview | 2 |
| `src/components/admin/PricePreviewCard.tsx` | Shows breakdown: metal cost, labor, making, GST, final | 2 |
| `src/components/pages/admin/ProductPriceHistoryDrawer.tsx` | Side drawer from product detail showing price history table | 2 |
| `src/components/pages/admin/AdminRateQuotes.tsx` | Quotes list + create CTA | 4 |
| `src/components/pages/admin/AdminRateQuoteForm.tsx` | Quote builder (pick products, qty, lock duration) | 4 |
| `src/components/pages/RateQuotePage.tsx` | Public quote viewer at `/quote/:token` with countdown + "Place order at locked price" | 4 |
| `src/components/PriceFreshnessBadge.tsx` | "Updated 12 min ago" badge on gold/silver/platinum product detail | 5 |
| `src/components/admin/PriceHistoryChart.tsx` | Recharts line chart — price overlay with rate history | 5 |

Nav update (`src/components/pages/admin/AdminLayout.tsx` lines 14–19): add `{ path: "/admin/metal-rates", icon: TrendingUp, label: "Rates" }` in Phase 1, `{ path: "/admin/rate-quotes", icon: FileText, label: "Quotes" }` in Phase 4.

Routes (`src/App.tsx` lines 125–136): add `<Route path="metal-rates" element={<AdminMetalRates />} />` in Phase 1; `<Route path="rate-quotes" element={<AdminRateQuotes />} />` in Phase 4; public `<Route path="/quote/:token" element={<RateQuotePage />} />` in Phase 4.

## Phase 1 — Rates infrastructure + admin viewer (M)

**Scope:** Stand up `metal_rates` and the admin page. No formula or recalc logic yet — the page is read + manual-insert only. Sets the foundation everything else builds on.

**Files to create:**
- `supabase/migrations/20260420_01_metal_rates.sql` — `metal_rates` table + indexes + seed rows (one per metal/purity pair, rate = 0, source = 'manual', `is_current` = TRUE)
- `src/components/pages/admin/AdminMetalRates.tsx`
- `src/components/admin/ManualRateDialog.tsx`

**Files to modify:**
- `src/components/lib/sdk.ts` — add `metalRateService` with dev mock array `DEV_METAL_RATES` seeded with today's rates (gold 22k ~₹7,200/g, 18k ~₹5,900/g, silver 925 ~₹90/g, etc.)
- `src/components/types/index.ts` — add `MetalRate`, `MetalType`, `MetalPurity`, `RateSource`
- `src/components/pages/admin/AdminLayout.tsx` — nav item
- `src/App.tsx` — route registration
- `supabase/schema.sql` — append table DDL (keep as canonical reference even though migration file is source of truth)

**Acceptance criteria:**
- Admin navigates to `/admin/metal-rates`, sees table with one row per metal/purity pair
- Inserting a manual rate via dialog flips previous `is_current` to FALSE and inserts new row with `is_current = TRUE` atomically (single transaction)
- `adminLogService.logAction('rate_set_manual', 'metal_rate', rate.id, { metal_type, purity, rate })` fires on every manual entry
- Dev mode renders identically from `DEV_METAL_RATES` without Supabase calls

**Verification:**
- Run migration against local Supabase: `supabase db reset && supabase db push`
- Toggle `VITE_DEV_MODE=true` and confirm the page renders with mock rates
- In prod (or a staging Supabase project): insert a rate via UI, run `SELECT COUNT(*) FROM metal_rates WHERE is_current = TRUE AND metal_type='gold' AND metal_purity='22k'` — must return 1

## Phase 2 — Per-product formula + recalc RPC (L)

**Scope:** Formula storage, recalc RPC, embedded formula UI in product form, price history log. When `auto_price_enabled=TRUE`, the `price` and `mrp` inputs on the admin product form render read-only and display the computed value live. Formula changes trigger immediate recalc; rate changes (Phase 3) will trigger batch recalc.

**Files to create:**
- `supabase/migrations/20260420_02_pricing_formula.sql` — `product_pricing_formula`, `product_price_history`, `products.pricing_mode` column, `recalc_product_price`, `recalc_all_auto_priced_products` RPCs
- `src/components/admin/PricingFormulaSection.tsx`
- `src/components/admin/PricePreviewCard.tsx`
- `src/components/pages/admin/ProductPriceHistoryDrawer.tsx`

**Files to modify:**
- `src/components/pages/admin/AdminProductForm.tsx` — embed `PricingFormulaSection` right after existing pricing fields (around line 529–554). When `auto_price_enabled` is on, disable the `price` and `mrp` inputs and show computed values. On save, upsert formula row then call `pricingFormulaService.recalc(product_id, 'formula_change')`.
- `src/components/lib/sdk.ts` — add `pricingFormulaService`; dev mock mutates an in-memory `DEV_FORMULAS` map + recalculates `DEV_PRODUCTS[i].price` using the JS-side formula mirror
- `src/components/types/index.ts` — add `ProductPricingFormula`, `ProductPriceHistory`, `PriceBreakdown`, `PriceTrigger`

**Decision to resolve in this phase:** `gst_inclusive` default. Build the UI with both modes selectable; pick a default after pricing the first few products and seeing which matches the existing `products.price` values. Commit the default in a follow-up migration.

**Acceptance criteria:**
- Toggling auto-price saves formula row; `products.pricing_mode` flips to `'auto'`
- `product_price_history` row inserted on every formula change with `trigger='formula_change'`
- Product list + detail pages reflect new price within cache TTL (60s for list, 300s for detail)
- Cache invalidated via existing `cache.invalidateByPrefix('products')` after recalc
- Disabling auto-price restores manual inputs; existing `price`/`mrp` values preserved (formula row stays, just `auto_price_enabled=FALSE`)

**Verification:**
- Dev: mock `pricingFormulaService.recalc` returns deterministic value; assert product form displays it
- Prod: edit a gold 22k product, set formula (rate × weight + 12% making + 3% GST), confirm `product_price_history` row and that `ProductDetailPage.tsx` (lines 396–428) strike-through MRP reflects new value
- Sanity: disable auto-price, edit manually, confirm no history row with `formula_change` trigger appears

## Phase 3 — Scheduled refresh + provider abstraction (M)

**Scope:** Wire the edge function, the cron schedule, the provider registry. Defaults to `mock` or `manual` provider (no external calls); external providers (`ibja`, `goldapi`, `metals_api`) are skeletons only — they return `[]` and log "not implemented". Admin "Refresh now" button becomes functional.

**Files to create:**
- `supabase/functions/refresh-metal-rates/index.ts`
- `supabase/functions/_shared/rateProviders/index.ts` (registry)
- `supabase/functions/_shared/rateProviders/{mock,manual,ibja,goldapi,metals_api}.ts`
- `supabase/migrations/20260420_03_cron_rate_refresh.sql` — uses `cron.schedule()` for 30-min interval

**Files to modify:**
- `src/components/lib/sdk.ts` — `metalRateService.refreshNow()` posts to edge function with admin JWT; dev mock returns `{ updated: 12, ratesInserted: 0 }` instantly
- `src/components/pages/admin/AdminMetalRates.tsx` — wire "Refresh now" button; show `last_refreshed` timestamp; toast on success/failure

**Acceptance criteria:**
- Cron fires every 30 min (configurable window); manual button works on demand
- With `METAL_RATE_PROVIDER=mock`, new rates are inserted and all auto-priced products are recalculated with matching `rate_id` in their history row
- With `METAL_RATE_PROVIDER=manual` (default), the cron runs but inserts nothing; recalc still fires only if a prior manual rate hasn't yet been applied to all products
- Admin log entry `rate_refreshed` appears after every refresh

**Verification:**
- Invoke edge function manually: `supabase functions invoke refresh-metal-rates --no-verify-jwt`
- Confirm all auto-priced product rows in `product_price_history` share the same `rate_id` for that batch
- Temporarily set `METAL_RATE_PROVIDER` to an unknown value; function should fall back to `mock` and log a warning

## Phase 4 — B2B rate-locked quotes (M)

**Scope:** Admin creates a quote for a B2B buyer (pick products, qty, lock 24/48/72h). System snapshots current prices + rate IDs; generates a public URL token. Customer opens URL, sees countdown + totals; accepts → order created with locked prices even if rates have moved. Expired quotes auto-flip via daily cron.

**Files to create:**
- `supabase/migrations/20260420_04_rate_quotes.sql`
- `src/components/pages/admin/AdminRateQuotes.tsx`
- `src/components/pages/admin/AdminRateQuoteForm.tsx`
- `src/components/pages/RateQuotePage.tsx`
- `supabase/functions/expire-rate-quotes/index.ts` — daily cron

**Files to modify:**
- `src/App.tsx` — add `/admin/rate-quotes` route and public `/quote/:token` route
- `src/components/pages/admin/AdminLayout.tsx` — nav item
- `src/components/lib/sdk.ts` — add `rateLockedQuoteService`; dev mock holds an in-memory quotes array
- `src/components/pages/CheckoutPage.tsx` — accept `?quote=token` query param; when present, bypass normal cart pricing and use `quote.items[i].locked_price`
- `src/components/types/index.ts` — add `RateLockedQuote`, `QuoteItem`

**Acceptance criteria:**
- Quote survives rate change: Phase 3's cron refreshes rates, but the quote URL still shows locked prices
- Checkout path via `?quote=token` produces an order whose `items[].price` matches `locked_price`, not the current product price
- Expired quotes transition from `active` to `expired` within 24h
- `rate_quote.status` transitions to `converted` and `converted_order_id` populated when customer completes checkout

**Verification:**
- Dev: create a quote, mutate `DEV_METAL_RATES`, confirm quote page still shows original locked prices
- Prod: create quote → open in incognito → start checkout → trigger `refresh-metal-rates` in parallel → verify order's item prices equal the locked prices
- Check-in: confirm public quote URL does not leak admin-only fields (`created_by`, full rate history) in its response

## Phase 5 — Customer freshness UI + history chart (S)

**Scope:** Add a small "Updated N min ago" badge on product cards and detail pages for gold/silver/platinum items that are auto-priced. Add a Recharts line-chart drill-down for admin showing 30-day price history overlaid with rate history.

**Files to create:**
- `src/components/PriceFreshnessBadge.tsx`
- `src/components/admin/PriceHistoryChart.tsx`

**Files to modify:**
- `src/components/pages/ProductDetailPage.tsx` — insert badge near existing price block (lines 396–428)
- `src/components/ProductCard.tsx` — optional small indicator dot
- `src/components/pages/admin/AdminMetalRates.tsx` — embed `PriceHistoryChart` in per-row drill-down

**Acceptance criteria:**
- Badge visible only when `pricing_mode='auto'` AND current rate is `< 24h` old
- Badge turns amber if the current rate is `> 6h` old, red if `> 24h`
- Chart renders 30 days of price history without flicker; empty-state message if no history

**Verification:**
- Dev: seed a `DEV_PRICE_HISTORY` array covering 30 days; chart renders
- Prod: insert a rate manually with `fetched_at = NOW() - INTERVAL '7 hours'` → badge turns amber on product detail page

## Open questions (for later phases)

- Which provider do we integrate first in the external-feed follow-up? (IBJA scraper, GoldAPI.io, Metals-API)
- Per-region rates (different GST by state) — one national rate for now; defer
- Do `white_gold` and `rose_gold` derive from 22k/18k gold, or are they independently quoted?
- Quote PDF generation — start with browser print-to-PDF on `/quote/:token`; invest in a Deno PDF renderer only if customers request email-attached PDFs

## Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| External rate source flakiness (later) | Provider abstraction + automatic `mock` fallback + admin email alert if `metal_rates.fetched_at` older than 6h |
| Price change mid-cart | Phase 4 groundwork (locked quote); optionally flash a "Price updated" banner in Phase 5 if cart item price diverges >2% from current |
| Runaway recalcs on bulk formula edits | `recalc_all_auto_priced_products` runs sequentially with advisory lock per product_id; UI debounces formula saves 300ms |
| Rounding drift (Postgres DECIMAL vs JS Number) | Authoritative recalc in SQL; JS preview flagged "preview only" until server confirms |
| Quote token shared too widely | Rate-limit `/quote/:token` access; log IP + user-agent; optionally require email OTP to view |

## Effort rollup

| Phase | Effort |
|-------|--------|
| 1 | M |
| 2 | L |
| 3 | M |
| 4 | M |
| 5 | S |

---

# Feature 2 — End-to-End Custom Order Pipeline (with out-of-stock MTO conversion)

## Objective

Unify two production flows that are currently either manual or broken: (a) from-scratch custom design requests, and (b) made-to-order (MTO) conversions of catalog products when demand exceeds stock. Both flow into one `custom_jobs` pipeline with vendor assignment, milestone tracking with photos, deposit/final payment splits, customer-facing public tracker, and automated notifications. Simultaneously fix the existing stock race condition with an atomic reservation RPC.

## Data Model

### New tables

```sql
-- Karigar / vendor registry
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',  -- ['casting','stone_setting','polishing','cad','engraving','assembly']
  reliability_score DECIMAL(3,2) DEFAULT 5.00,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  address JSONB,
  notes TEXT,
  auth_user_id UUID REFERENCES auth.users(id),  -- populated in Phase 5 for vendor portal
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vendors_active ON vendors(active);

-- Unified custom job: spans custom requests + MTO orders
CREATE TABLE custom_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_number TEXT UNIQUE NOT NULL,  -- CJ-2026-0001 (from sequence)
  source TEXT NOT NULL CHECK (source IN ('custom_request','mto','admin_manual')),
  custom_request_id UUID REFERENCES custom_requests(id),
  product_id UUID REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  vendor_id UUID REFERENCES vendors(id),
  title TEXT NOT NULL,
  specification JSONB NOT NULL,  -- {metal_type, purity, weight, stones, size, design_notes, reference_images[], cad_files[]}
  status TEXT NOT NULL DEFAULT 'intake' CHECK (status IN
    ('intake','design','quoted','approved','deposit_pending','in_production',
     'qc','ready_for_dispatch','dispatched','delivered','cancelled','on_hold')),
  deposit_amount DECIMAL(12,2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT FALSE,
  final_amount DECIMAL(12,2) DEFAULT 0,
  final_paid BOOLEAN DEFAULT FALSE,
  estimated_ready_date DATE,
  actual_ready_date DATE,
  tracking_token TEXT UNIQUE NOT NULL,  -- public token for /track/:token
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_source CHECK (
    (source='custom_request' AND custom_request_id IS NOT NULL AND product_id IS NULL) OR
    (source='mto' AND product_id IS NOT NULL) OR
    (source='admin_manual')
  )
);
CREATE INDEX idx_custom_jobs_status ON custom_jobs(status);
CREATE INDEX idx_custom_jobs_vendor ON custom_jobs(vendor_id);
CREATE INDEX idx_custom_jobs_customer ON custom_jobs(customer_email);
CREATE INDEX idx_custom_jobs_order ON custom_jobs(order_id);

-- Milestones with photo uploads
CREATE TABLE custom_job_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES custom_jobs(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL CHECK (milestone IN
    ('design_approved','cad_ready','wax_model','casting','stone_setting','finishing','qc','ready')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  photos JSONB NOT NULL DEFAULT '[]',  -- [string] full storage URLs
  note TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,  -- vendor email or admin email
  UNIQUE(job_id, milestone)
);
CREATE INDEX idx_milestones_job ON custom_job_milestones(job_id);

-- App-level settings (for MTO global defaults + future flags)
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Seed: ('mto_default_deposit_pct', '50')

-- Job number sequence
CREATE SEQUENCE custom_job_seq START 1;
```

### Extensions to existing tables

```sql
-- Orders: link to custom jobs + split payments
ALTER TABLE orders ADD COLUMN custom_job_id UUID REFERENCES custom_jobs(id);
ALTER TABLE orders ADD COLUMN payment_split JSONB;
-- payment_split shape: { deposit: {amount, status, payment_id, paid_at}, final: {amount, status, payment_id, paid_at} }

-- Expand order_status enum with MTO states
ALTER TABLE orders DROP CONSTRAINT orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check CHECK (order_status IN
  ('placed','confirmed','processing','shipped','delivered','cancelled','payment_failed',
   'mto_awaiting_deposit','mto_in_production','mto_ready_for_dispatch'));

-- Products: MTO opt-in + per-product override
ALTER TABLE products ADD COLUMN allow_mto BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN mto_lead_time_weeks INTEGER DEFAULT 4;
ALTER TABLE products ADD COLUMN mto_deposit_pct DECIMAL(5,2);  -- NULL = use app_settings global default
```

### Postgres RPCs

- `reserve_product_stock(p_product_id UUID, p_qty INT) RETURNS TABLE(reserved INT, remaining INT, mto_required BOOLEAN)` — uses `SELECT ... FOR UPDATE` on `products.id`. If `stock_quantity >= p_qty`, decrements and returns `reserved=qty, mto_required=FALSE`. Else if `allow_mto=TRUE`, returns `reserved=0, mto_required=TRUE`. Else raises exception.
- `release_product_stock(p_product_id UUID, p_qty INT) RETURNS VOID` — re-increments on order cancellation.
- `resolve_mto_deposit_pct(p_product_id UUID) RETURNS DECIMAL` — returns `products.mto_deposit_pct` if set, else `app_settings.value::decimal` for key `mto_default_deposit_pct`.

## Service Layer (`src/components/lib/sdk.ts`)

```ts
export const vendorService = {
  list(filter?: { active?: boolean }): Promise<Vendor[]>;
  get(id: string): Promise<Vendor>;
  create(input: VendorInput): Promise<Vendor>;
  update(id: string, patch: Partial<VendorInput>): Promise<Vendor>;
  archive(id: string): Promise<void>;
  scorecard(id: string): Promise<VendorScorecard>;  // Phase 5
};

export const customJobService = {
  list(filter: { status?; vendor_id?; source?; q?; limit?; offset? }): Promise<CustomJobSummary[]>;
  get(id: string): Promise<CustomJobDetail>;
  getByToken(token: string): Promise<CustomJobPublic>;  // no auth; redacted
  createFromRequest(custom_request_id: string, spec: JobSpecification): Promise<CustomJob>;
  createFromMTO(product_id: string, order_id: string, qty: number, spec: JobSpecification): Promise<CustomJob>;
  update(id: string, patch: Partial<CustomJob>): Promise<CustomJob>;
  assignVendor(id: string, vendor_id: string): Promise<void>;
  setMilestone(job_id: string, milestone: MilestoneName, patch: MilestonePatch): Promise<CustomJobMilestone>;
  uploadMilestonePhoto(job_id: string, milestone: MilestoneName, file: File): Promise<string>;
};

export const stockService = {
  reserve(product_id: string, qty: number):
    Promise<{ reserved: number; remaining: number; mto_required: boolean }>;
  release(product_id: string, qty: number): Promise<void>;
};

export const appSettingsService = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
};
```

All follow the `if (isDev)` mock pattern. Dev mocks seed 3 vendors, `DEV_SETTINGS` with `mto_default_deposit_pct=50`, and stock `reserve` that mutates `DEV_PRODUCTS[i].stock_quantity` directly.

## Edge Functions

- `supabase/functions/custom-job-notify/index.ts`
  - Input: `{ job_id, event: 'status_change' | 'milestone_completed' | 'deposit_due' | 'ready' }`
  - Loads job + customer, composes Resend email with milestone photo, sends
  - Invoked from DB triggers `AFTER UPDATE ON custom_jobs` and `AFTER UPDATE ON custom_job_milestones` via `pg_net.http_post`
- `supabase/functions/mto-quote/index.ts` (Phase 4)
  - Input: `{ product_id, qty }`. Uses current pricing (integrates with Feature 1 when available) to compute `{ unit_price, deposit_amount, final_amount, lead_weeks }`

## Types (`src/components/types/index.ts`)

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
  auth_user_id?: string;
  created_at: string;
}

export interface VendorInput {
  name: string;
  phone?: string;
  email?: string;
  specialties: VendorSpecialty[];
  address?: Record<string, string>;
  notes?: string;
}

export interface VendorScorecard {
  vendor_id: string;
  jobs_completed: number;
  on_time_pct: number;
  avg_lead_days: number;
  revisions_per_job: number;
}

export type CustomJobSource = 'custom_request' | 'mto' | 'admin_manual';
export type CustomJobStatus =
  | 'intake' | 'design' | 'quoted' | 'approved' | 'deposit_pending'
  | 'in_production' | 'qc' | 'ready_for_dispatch' | 'dispatched'
  | 'delivered' | 'cancelled' | 'on_hold';
export type MilestoneName =
  | 'design_approved' | 'cad_ready' | 'wax_model' | 'casting'
  | 'stone_setting' | 'finishing' | 'qc' | 'ready';

export interface JobSpecification {
  metal_type?: MetalType;
  metal_purity?: MetalPurity;
  weight_grams?: number;
  stone_config?: StoneConfig;
  size?: string;
  design_notes?: string;
  reference_images?: string[];
  cad_files?: string[];
}

export interface StoneConfig {
  count?: number;
  quality?: string;
  grade?: string;
  setting?: string;
}

export interface CustomJob {
  id: string;
  job_number: string;
  source: CustomJobSource;
  custom_request_id?: string;
  product_id?: string;
  order_id?: string;
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  vendor_id?: string;
  title: string;
  specification: JobSpecification;
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

export interface MilestonePatch {
  status?: 'pending' | 'in_progress' | 'done' | 'skipped';
  photos?: string[];
  note?: string;
}

export interface CustomJobSummary extends Pick<CustomJob,
  'id' | 'job_number' | 'source' | 'title' | 'status' | 'customer_email' |
  'estimated_ready_date' | 'vendor_id'> {
  milestone_progress: number;  // 0-100
}

export interface CustomJobDetail extends CustomJob {
  vendor?: Vendor;
  milestones: CustomJobMilestone[];
}

export interface CustomJobPublic extends Pick<CustomJob,
  'id' | 'job_number' | 'title' | 'status' | 'estimated_ready_date' |
  'deposit_amount' | 'final_amount'> {
  milestones: Array<Pick<CustomJobMilestone, 'milestone' | 'status' | 'photos' | 'completed_at'>>;
}

export interface OrderPaymentSplit {
  deposit: { amount: number; status: 'pending' | 'paid'; payment_id?: string; paid_at?: string };
  final:   { amount: number; status: 'pending' | 'paid'; payment_id?: string; paid_at?: string };
}
```

Extend `OrderStatus` union with `'mto_awaiting_deposit' | 'mto_in_production' | 'mto_ready_for_dispatch'`. Extend `AdminActionType` with `'vendor_created' | 'vendor_updated' | 'job_created' | 'job_status_changed' | 'milestone_updated' | 'mto_converted'`.

## UI Additions

| File | Purpose | Phase |
|------|---------|-------|
| `src/components/pages/admin/AdminVendors.tsx` | Vendor list + CRUD | 1 |
| `src/components/pages/admin/AdminVendorForm.tsx` | Vendor create/edit | 1 |
| `src/components/pages/admin/AdminCustomJobs.tsx` | Unified kanban/table board | 2 |
| `src/components/pages/admin/AdminCustomJobDetail.tsx` | Job detail — timeline, vendor, photos, payments | 2 |
| `src/components/admin/MilestoneTimeline.tsx` | Reusable timeline component | 2 |
| `src/components/admin/MilestoneEditor.tsx` | Per-milestone edit UI with photo upload | 2 |
| `src/components/admin/JobVendorAssignDialog.tsx` | Vendor picker dialog | 2 |
| `src/components/pages/TrackCustomJobPage.tsx` | Public tracker at `/track/:token` | 3 |
| `src/components/pages/MyCustomJobsPage.tsx` | Authenticated customer jobs list | 3 |
| `src/components/CustomerMilestoneTimeline.tsx` | Redacted public-facing timeline | 3 |
| `src/components/checkout/MTOConfirmDialog.tsx` | MTO acceptance dialog at checkout | 4 |
| `src/components/admin/FinalInvoiceDialog.tsx` | Admin "Send final invoice" action | 4 |
| `src/components/admin/MTOConversionDialog.tsx` | Manual conversion for edge cases | 4 |
| `src/components/pages/vendor/VendorLayout.tsx` | Vendor portal shell | 5 |
| `src/components/pages/vendor/VendorDashboard.tsx` | Vendor home | 5 |
| `src/components/pages/vendor/VendorJobDetail.tsx` | Vendor-side job view | 5 |
| `src/components/admin/VendorScorecard.tsx` | Scorecard widget | 5 |

Nav additions (`AdminLayout.tsx` lines 14–19):
- Phase 1: `{ path: "/admin/vendors", icon: Users, label: "Vendors" }`
- Phase 2: `{ path: "/admin/custom-jobs", icon: Hammer, label: "Jobs" }` (may replace or nest under existing "Custom Requests" item — discuss before shipping)

Routes (`src/App.tsx` lines 125–136):
- Phase 1: `<Route path="vendors" element={<AdminVendors />} />`, `<Route path="vendors/new" />`, `<Route path="vendors/:id" />`
- Phase 2: `<Route path="custom-jobs" />`, `<Route path="custom-jobs/:id" />`
- Phase 3: public `<Route path="/track/:token" element={<TrackCustomJobPage />} />`; authenticated `<Route path="/my-custom-jobs" />`
- Phase 5: vendor route group `<Route path="/vendor/*" element={<VendorLayout />}>`

## Phase 1 — Schema, vendors, atomic stock RPC, types (M)

**Scope:** Land all three new tables + schema extensions; implement `reserve_product_stock` / `release_product_stock` RPCs; seed `app_settings` with `mto_default_deposit_pct=50`; build vendors CRUD UI; no custom-job UI yet. This phase also closes the existing overselling race condition.

**Files to create:**
- `supabase/migrations/20260420_10_custom_jobs_schema.sql`
- `supabase/migrations/20260420_11_app_settings.sql`
- `src/components/pages/admin/AdminVendors.tsx`
- `src/components/pages/admin/AdminVendorForm.tsx`

**Files to modify:**
- `supabase/schema.sql` — append new tables + alterations
- `src/components/lib/sdk.ts` — add `vendorService`, `stockService`, `appSettingsService`; dev mocks: 3 seeded vendors, stub `reserve` that mutates `DEV_PRODUCTS[i].stock_quantity`
- `src/components/types/index.ts` — Vendor + settings types
- `src/components/pages/admin/AdminLayout.tsx` — nav item
- `src/App.tsx` — vendor routes
- `src/components/pages/CheckoutPage.tsx` — replace direct stock check with `stockService.reserve(product_id, qty)` BEFORE Razorpay order creation. If the call fails or returns `mto_required=true` with `allow_mto=false`, block checkout with an error toast
- `src/components/pages/CartPage.tsx` — the `stock_quantity` check at line 115 stays as a UX hint; actual enforcement is now server-side

**Acceptance criteria:**
- RPC rejects oversell under parallel load: open two tabs, each tries to reserve `qty=3` when `stock_quantity=4` → one succeeds with `reserved=3, remaining=1`, other returns `reserved=0` (either mto_required=true or exception)
- Vendors CRUD round-trips; admin log entries `vendor_created`, `vendor_updated` fire
- `app_settings.mto_default_deposit_pct=50` readable via `appSettingsService.get`
- Existing orders continue to function; order_status CHECK constraint now permits three new MTO values without breaking legacy rows

**Verification:**
- Run migration on a staging Supabase project
- Two terminal SQL sessions: `BEGIN; SELECT * FROM reserve_product_stock(...); -- hold` and from another session `SELECT * FROM reserve_product_stock(...);` — second blocks until first commits
- Dev mode: create a vendor via UI, assert it shows in list
- Confirm `CheckoutPage` still completes a normal in-stock order without regressions

## Phase 2 — Admin custom jobs board (L)

**Scope:** Unified admin page combining existing custom requests (auto-promoted to `custom_jobs` on first admin action via a "Promote to job" button) and future MTO jobs. Kanban + table views. Detail page with milestone timeline, vendor picker, deposit/final payment toggles, photo upload per milestone.

**Files to create:**
- `src/components/pages/admin/AdminCustomJobs.tsx`
- `src/components/pages/admin/AdminCustomJobDetail.tsx`
- `src/components/admin/MilestoneTimeline.tsx`
- `src/components/admin/MilestoneEditor.tsx`
- `src/components/admin/JobVendorAssignDialog.tsx`

**Files to modify:**
- `src/components/lib/sdk.ts` — add `customJobService`; dev mocks seed 2 jobs (one `custom_request` source, one `mto` source)
- `src/App.tsx` — add `custom-jobs` and `custom-jobs/:id` routes
- `src/components/pages/admin/AdminLayout.tsx` — nav item
- `src/components/pages/admin/AdminCustomRequestDetailPage.tsx` — add "Promote to job" button that calls `customJobService.createFromRequest(request_id, ...)` and navigates to the new job detail page

**Storage layout:** milestone photos upload to existing `images` bucket under prefix `custom-jobs/{job_id}/{milestone}/{timestamp}-{random}.{ext}` (reuse `storageService` patterns).

**Acceptance criteria:**
- Kanban view supports drag between status columns; table view supports status dropdown per row
- Milestone photo upload works (up to 5 photos per milestone, 10MB each enforced client-side)
- Status changes log `job_status_changed` with before/after in `adminLogService`
- "Promote to job" on an existing custom request creates a `custom_jobs` row with `source='custom_request'` and `custom_request_id` linked

**Verification:**
- Dev: use mocked service, exercise full kanban flow
- Prod: upload a 3MB photo, confirm CDN URL stored in `custom_job_milestones.photos` JSONB array
- Promote one existing custom request, confirm job_number is auto-generated (`CJ-2026-0001` format), and the original `custom_requests` row is untouched

## Phase 3 — Customer tracker + milestone emails (M)

**Scope:** Public `/track/:token` page (no login) and authenticated `/my-custom-jobs` page for logged-in customers. DB triggers fire `custom-job-notify` edge function on status change and milestone completion. Customer email template includes embedded milestone photo.

**Files to create:**
- `src/components/pages/TrackCustomJobPage.tsx`
- `src/components/pages/MyCustomJobsPage.tsx`
- `src/components/CustomerMilestoneTimeline.tsx`
- `supabase/functions/custom-job-notify/index.ts`
- `supabase/migrations/20260420_12_custom_job_triggers.sql` — `AFTER UPDATE` triggers on `custom_jobs.status` and `custom_job_milestones.status`

**Files to modify:**
- `src/App.tsx` — public `/track/:token` route + authenticated `/my-custom-jobs` route
- `src/components/lib/sdk.ts` — add `customJobService.getByToken`; dev mock returns a static sample
- `src/components/pages/MyCustomRequestsPage.tsx` — if the request has been promoted (`custom_jobs.custom_request_id = request.id`), show a "View production status" link

**Acceptance criteria:**
- Visiting `/track/{token}` without login shows the redacted public view: milestone photos yes, vendor name no, payment amounts yes, payment IDs no
- Email arrives via Resend within ~30s of a milestone being marked `done`
- Authenticated `/my-custom-jobs` merges legacy `custom_requests` (unpromoted) + new `custom_jobs` into one sorted list

**Verification:**
- Dev: mock `getByToken` returns sample; page renders offline
- Prod: mark a milestone `done`, verify Resend dashboard shows delivered email with embedded photo
- Lighthouse check on `/track/:token`: LCP under 2.5s on 4G throttled

## Phase 4 — Out-of-stock → MTO conversion + deposit split (L)

**Scope:** During checkout, if `stockService.reserve` returns `mto_required=true`, render `MTOConfirmDialog` explaining the timeline and deposit. On accept, create a `custom_jobs` row (source=`mto`), create `orders` row with `payment_split`, charge deposit only via Razorpay, status `mto_awaiting_deposit`. Admin triggers the final-payment flow later.

**Files to create:**
- `src/components/checkout/MTOConfirmDialog.tsx`
- `src/components/admin/FinalInvoiceDialog.tsx`
- `src/components/admin/MTOConversionDialog.tsx` (manual conversion on `AdminOrderDetail`)
- `supabase/functions/mto-quote/index.ts`
- `supabase/migrations/20260420_13_mto_flow.sql` (optional — any additional constraints)

**Files to modify:**
- `src/components/pages/CheckoutPage.tsx` — branch on `mto_required` from the reservation call
- `src/components/pages/CartPage.tsx` — show "Made-to-order eligible" badge near items where `stock_quantity < requested_qty && allow_mto`
- `src/components/lib/sdk.ts` — `orderService.createMTOOrder`, `orderService.chargeFinal`
- `src/components/pages/admin/AdminOrderDetail.tsx` — payment_split ledger UI, "Send final invoice" CTA
- `src/components/pages/admin/AdminCustomJobDetail.tsx` — surface the linked order + payment split

**Acceptance criteria:**
- Customer accepting MTO receives deposit invoice email and sees status `mto_awaiting_deposit` on `/my-orders`
- Deposit paid → status auto-transitions to `mto_in_production`; triggers vendor-assignment prompt in admin
- Admin clicking "Send final invoice" creates a second Razorpay order for the remainder; customer gets payment link email
- Final paid → status `mto_ready_for_dispatch`, then admin proceeds with normal shipping flow

**Verification:**
- Dev: synthetic checkout with `DEV_PRODUCTS[0].stock_quantity=0, allow_mto=true` → dialog appears; both payments mocked
- Prod with Razorpay test keys: full E2E — deposit, production state, final invoice, final charge, dispatch. Confirm `orders.payment_split` JSONB is correctly populated at each step

## Phase 5 — Vendor portal + karigar scorecards (L)

**Scope:** Lightweight vendor authentication via Supabase magic link. Vendors log in at `/vendor/login`, see only their assigned jobs, can update milestones and upload photos directly (removing admin-middleman for photo updates). Scorecards (on-time %, avg lead time, revisions per job) on `AdminVendors` page.

**Files to create:**
- `src/components/pages/vendor/VendorLayout.tsx`
- `src/components/pages/vendor/VendorDashboard.tsx`
- `src/components/pages/vendor/VendorJobDetail.tsx`
- `src/components/admin/VendorScorecard.tsx`
- `supabase/migrations/20260420_14_vendor_auth.sql` — RLS policies scoping `custom_jobs` and `custom_job_milestones` to `vendor_id = vendors.id WHERE vendors.auth_user_id = auth.uid()`

**Files to modify:**
- `src/App.tsx` — `/vendor/*` route group
- `src/components/store/auth-store.ts` — add `vendor` role support
- `src/components/lib/sdk.ts` — `vendorService.scorecard`, `customJobService.listForVendor`

**Acceptance criteria:**
- Vendor logs in via magic link → sees only their own jobs
- Uploading a milestone photo triggers the same email chain as admin upload
- Scorecard computes from `custom_jobs` history (deadline vs actual_ready_date, vendor-triggered status changes, count of `on_hold` transitions as revision proxy)
- RLS regression: authenticated as vendor A, query `custom_jobs WHERE vendor_id = (SELECT id FROM vendors WHERE auth_user_id != auth.uid())` returns zero rows

**Verification:**
- Dev: mock vendor role, render vendor dashboard
- Prod: create vendor, link `auth_user_id`, log in as vendor; attempt to curl another vendor's job via Supabase REST → 0 results

## Open questions (for later phases)

- Migration of existing `custom_requests` rows to `custom_jobs` at deploy: **keep as intake, promote on first admin action** (already specified in Phase 2)
- 5-comment cap on existing custom requests (`CustomRequestDetailPage.tsx:130`): keep for legacy, remove for jobs
- Vendor portal language: English-only at launch; Hindi/Gujarati as future enhancement
- Tracking token format: use 16-char `crypto.randomUUID()` substring — short enough to share, long enough to resist guessing
- Cancellation refund policy: automate partial refund of deposit stage only; full-production cancellations routed to admin manual refund

## Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| Stock reservation race | `SELECT ... FOR UPDATE` in RPC; release on payment failure via Razorpay webhook (extend `verify-razorpay-payment`) |
| Milestone notification spam | Debounce per job (one email per status change, configurable "quiet" milestones like `qc`) |
| Photo storage bloat | 5 photos / milestone cap, 10MB per upload cap enforced in edge function, purge on `cancelled` jobs older than 1 year |
| Vendor RLS misconfiguration leaking data | Regression test in `tests/rls.sql`: authenticated-as-vendor SELECTs on jobs with different `vendor_id` must return 0 rows |
| `orders.order_status` CHECK migration on large table | Drop + re-add is fine for DigitalJems scale; for large datasets use `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` in a separate transaction |

## Effort rollup

| Phase | Effort |
|-------|--------|
| 1 | M |
| 2 | L |
| 3 | M |
| 4 | L |
| 5 | L |

---

# Feature 3 — One-Click Multi-Channel Publishing

## Objective

Give the admin a Channels settings hub to connect external marketplaces and social commerce surfaces (Meta Catalog powering Instagram Shopping + Facebook Shop + WhatsApp Catalog, Pinterest, Google Merchant, IndiaMART, Amazon, Flipkart). From any product, admin publishes to one, many, or scheduled subsets of channels, with retries, per-channel listing URL tracking, and bulk + schedule support. Secrets are encrypted at rest. Adapters follow a registry pattern so adding a channel is a constrained code change rather than an architectural one. **Pilot channel in Phase 3 is Meta Catalog.**

## Data Model

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Per-channel integration (enabled flag + config + encrypted secrets)
CREATE TABLE channel_integrations (
  channel_name TEXT PRIMARY KEY CHECK (channel_name IN
    ('instagram','pinterest','google_merchant','meta_catalog',
     'whatsapp_catalog','indiamart','amazon','flipkart')),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  account_id TEXT,  -- e.g. Meta Business ID, GMC Merchant ID
  config JSONB NOT NULL DEFAULT '{}',  -- non-sensitive (catalog_id, region, rate_limit)
  secrets_ciphertext BYTEA,  -- encrypted JSON blob with tokens
  secrets_nonce BYTEA,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-(product, channel) sync state
CREATE TABLE product_channel_status (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL REFERENCES channel_integrations(channel_name) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','synced','error','removed','scheduled')),
  external_id TEXT,  -- platform's product id
  listing_url TEXT,
  error_message TEXT,
  last_synced_at TIMESTAMPTZ,
  payload_hash TEXT,  -- skip no-op re-publishes
  PRIMARY KEY (product_id, channel_name)
);
CREATE INDEX idx_pcs_status ON product_channel_status(status);

-- Async queue for publish/update/remove jobs
CREATE TABLE channel_publish_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL REFERENCES channel_integrations(channel_name),
  action TEXT NOT NULL CHECK (action IN ('publish','update','remove')),
  publish_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN
    ('queued','running','succeeded','failed','cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  payload JSONB,  -- snapshot of data being sent
  result JSONB,  -- { external_id, listing_url }
  error_message TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_publish_jobs_due ON channel_publish_jobs(status, publish_at);
CREATE INDEX idx_publish_jobs_product ON channel_publish_jobs(product_id);

-- OAuth CSRF state
CREATE TABLE channel_oauth_state (
  state_token TEXT PRIMARY KEY,
  channel_name TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Encryption helpers (SQL, service-role only)

```sql
-- encrypt_secret(plaintext JSONB) RETURNS (ciphertext BYTEA, nonce BYTEA)
-- decrypt_secret(ciphertext BYTEA, nonce BYTEA) RETURNS JSONB
```

Key material sourced from Supabase Vault entry `channel_secret_key`. Fallback: pgcrypto symmetric with key in Supabase Secrets (decided in Phase 1 based on Vault availability on the project's plan).

## Service Layer (`src/components/lib/sdk.ts`)

```ts
export const channelIntegrationService = {
  list(): Promise<ChannelIntegration[]>;  // secrets masked, only has_secrets: boolean
  get(channel: ChannelName): Promise<ChannelIntegration>;
  updateConfig(channel: ChannelName, patch: Partial<ChannelConfig>): Promise<ChannelIntegration>;
  setEnabled(channel: ChannelName, enabled: boolean): Promise<void>;
  setSecrets(channel: ChannelName, secrets: Record<string, string>): Promise<void>;  // writes via edge fn; UI never reads back
  testConnection(channel: ChannelName): Promise<{ ok: boolean; detail?: string }>;
  beginOAuth(channel: ChannelName): Promise<{ redirectUrl: string }>;
  completeOAuth(channel: ChannelName, code: string, state: string): Promise<void>;
};

export const channelPublishService = {
  statusesForProduct(product_id: string): Promise<ProductChannelStatus[]>;
  enqueue(product_id: string, channel_names: ChannelName[], action: 'publish' | 'update' | 'remove', publish_at?: string): Promise<ChannelPublishJob[]>;
  bulkEnqueue(product_ids: string[], channel_names: ChannelName[], action: 'publish' | 'update' | 'remove', publish_at?: string): Promise<{ queued: number }>;
  retry(job_id: string): Promise<void>;
  cancelScheduled(job_id: string): Promise<void>;
  listJobs(filter: { channel?; status?; product_id? }): Promise<ChannelPublishJob[]>;
};
```

All `if (isDev)` mock. Dev simulates async success 2s after enqueue; secrets are masked in all reads.

## Edge Functions

- `supabase/functions/channel-publish-worker/index.ts`
  - Cron: every 60s
  - `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 10` for jobs where `status='queued' AND publish_at<=NOW()`
  - Marks `running`, calls appropriate adapter, writes back result, updates `product_channel_status`
  - On failure: `next_attempt_at = NOW() + 2^attempts * 30s` until `max_attempts` reached
  - Per-channel concurrency cap of 3 (rate-limit-friendly)
- `supabase/functions/channel-test-connection/index.ts` — per-channel dry-run (e.g. Meta `me?fields=id`, GMC `merchants.get`)
- `supabase/functions/channel-oauth-start/index.ts` — generates state, stores in `channel_oauth_state`, returns provider auth URL
- `supabase/functions/channel-oauth-callback/index.ts` — validates state, exchanges code → tokens, encrypts and stores
- `supabase/functions/_shared/channelAdapters/` — one file per channel exporting a `ChannelAdapter`:
  ```ts
  export interface ChannelAdapter {
    name: ChannelName;
    testConnection(secrets, config): Promise<{ ok: boolean; detail?: string }>;
    publish(product, secrets, config): Promise<{ external_id: string; listing_url?: string }>;
    update(product, existing, secrets, config): Promise<{ external_id: string; listing_url?: string }>;
    remove(external_id, secrets, config): Promise<void>;
  }
  ```
  Files in Phase 3+: `meta_catalog.ts`, `instagram.ts`, `whatsapp_catalog.ts`, `pinterest.ts`, `google_merchant.ts`, `indiamart.ts`, `amazon.ts`, `flipkart.ts`, plus `registry.ts`
- `supabase/functions/_shared/channelMappers/` — per-channel payload builders (product → channel-specific JSON)

## Types (`src/components/types/index.ts`)

```ts
export type ChannelName =
  | 'instagram' | 'pinterest' | 'google_merchant' | 'meta_catalog'
  | 'whatsapp_catalog' | 'indiamart' | 'amazon' | 'flipkart';

export interface ChannelIntegration {
  channel_name: ChannelName;
  is_enabled: boolean;
  account_id?: string;
  config: Record<string, unknown>;
  has_secrets: boolean;  // never return actual secrets to the client
  last_sync_at?: string;
  last_error?: string;
  updated_at: string;
}

export interface ProductChannelStatus {
  product_id: string;
  channel_name: ChannelName;
  status: 'pending' | 'synced' | 'error' | 'removed' | 'scheduled';
  external_id?: string;
  listing_url?: string;
  error_message?: string;
  last_synced_at?: string;
  payload_hash?: string;
}

export interface ChannelPublishJob {
  id: string;
  product_id: string;
  channel_name: ChannelName;
  action: 'publish' | 'update' | 'remove';
  publish_at: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  attempts: number;
  max_attempts: number;
  next_attempt_at?: string;
  result?: { external_id: string; listing_url?: string };
  error_message?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChannelRegistryEntry {
  channel_name: ChannelName;
  label: string;
  logoUrl: string;
  authType: 'oauth2' | 'api_key' | 'service_account';
  requiredConfig: ConfigField[];
  requiredSecrets: SecretField[];
  supports: Array<'publish' | 'update' | 'remove' | 'bulk'>;
  mediaTypes: Array<'image' | 'video' | 'carousel'>;
  rateLimitPerMinute?: number;
  docsUrl: string;
}

export interface ConfigField { key: string; label: string; type: 'text' | 'select'; options?: string[]; required: boolean; }
export interface SecretField { key: string; label: string; hint?: string; required: boolean; }
```

Extend `AdminActionType` with: `'channel_connected' | 'channel_disconnected' | 'channel_config_updated' | 'product_published' | 'product_unpublished' | 'bulk_publish_enqueued'`.

## UI Additions

| File | Purpose | Phase |
|------|---------|-------|
| `src/components/lib/channelRegistry.ts` | TS registry (mirrors edge registry) | 1 |
| `src/components/pages/admin/AdminChannels.tsx` | Landing grid of channel cards | 2 |
| `src/components/pages/admin/AdminChannelSettings.tsx` | Per-channel detail page (`/admin/channels/:channel`) | 2 |
| `src/components/admin/ChannelOAuthButton.tsx` | OAuth redirect button | 2 |
| `src/components/admin/ChannelSecretForm.tsx` | API key entry form | 2 |
| `src/components/admin/ChannelConfigForm.tsx` | Channel config editor | 2 |
| `src/components/admin/ChannelPublishPanel.tsx` | Per-product publish section (embedded in `AdminProductForm`) | 3 |
| `src/components/admin/ChannelStatusBadge.tsx` | Status pill (synced/pending/error) | 3 |
| `src/components/pages/admin/AdminChannelJobs.tsx` | Jobs queue viewer | 4 |
| `src/components/admin/BulkPublishDialog.tsx` | Multi-product publish dialog | 4 |
| `src/components/admin/SchedulePickerPopover.tsx` | Datetime picker for scheduled publish | 4 |

Nav (`AdminLayout.tsx`): add `{ path: "/admin/channels", icon: Share2, label: "Channels" }` in Phase 2; `{ path: "/admin/channel-jobs", icon: ListChecks, label: "Channel Jobs" }` in Phase 4.

Routes (`src/App.tsx`): Phase 2 — `channels`, `channels/:channel`, plus public `/oauth/channels/:channel/callback` that redirects into admin after OAuth. Phase 4 — `channel-jobs`.

## Phase 1 — Schema + encrypted secret storage + channel registry (M)

**Scope:** Land all three tables + OAuth state table; implement `encrypt_secret` / `decrypt_secret` in SQL; write the static `ChannelRegistry` TS module. Seed `channel_integrations` with one row per channel (all `is_enabled=false`). No UI yet except a placeholder admin page that confirms the data is loaded.

**Files to create:**
- `supabase/migrations/20260420_20_channels_schema.sql`
- `src/components/lib/channelRegistry.ts` (TS-side authoritative copy)
- `supabase/functions/_shared/channelAdapters/registry.ts` (Deno-side twin)

**Files to modify:**
- `supabase/schema.sql` — append tables
- `src/components/lib/sdk.ts` — stub `channelIntegrationService`, `channelPublishService`; dev mock `DEV_CHANNELS` seeded with all 8 (disabled)
- `src/components/types/index.ts` — add channel types

**Key decision in this phase:** check whether Supabase Vault is available on the project's current plan. If yes, use Vault. If no, use pgcrypto with key from `Deno.env.get('CHANNEL_SECRET_KEY')`.

**Acceptance criteria:**
- Encrypt/decrypt round-trips work in SQL (test with `SELECT decrypt_secret((SELECT * FROM encrypt_secret('{"token":"abc"}'::jsonb)))`)
- TS registry import compiles; 8 entries present
- `channel_integrations` has 8 rows (one per channel), all `is_enabled=false`, no secrets

**Verification:**
- Dev: import `channelRegistry`, assert `.length === 8`
- Prod: run `INSERT INTO channel_integrations (channel_name, secrets_ciphertext, secrets_nonce) SELECT 'meta_catalog', c, n FROM encrypt_secret('{"access_token":"test"}')` → `SELECT decrypt_secret(secrets_ciphertext, secrets_nonce) FROM channel_integrations WHERE channel_name='meta_catalog'` returns the original JSON

## Phase 2 — Admin Channels UI + per-channel config + test connection (L)

**Scope:** Build the landing grid and per-channel detail page. Implement OAuth start + callback edge functions (used by Meta and Google in Phase 3+). Implement API-key input form for channels that use static credentials. "Test connection" button hits edge function. Product form "Publish" section renders as a placeholder ("Save product first to publish").

**Files to create:**
- `src/components/pages/admin/AdminChannels.tsx`
- `src/components/pages/admin/AdminChannelSettings.tsx`
- `src/components/admin/ChannelOAuthButton.tsx`
- `src/components/admin/ChannelSecretForm.tsx`
- `src/components/admin/ChannelConfigForm.tsx`
- `supabase/functions/channel-oauth-start/index.ts`
- `supabase/functions/channel-oauth-callback/index.ts`
- `supabase/functions/channel-test-connection/index.ts`

**Files to modify:**
- `src/App.tsx` — add `/admin/channels`, `/admin/channels/:channel`, and public OAuth callback `/oauth/channels/:channel/callback` (just parses query and calls back into admin SDK)
- `src/components/pages/admin/AdminLayout.tsx` — nav item
- `src/components/lib/sdk.ts` — flesh out `channelIntegrationService` methods; dev mock `testConnection` returns random success/failure to exercise UI states

**Acceptance criteria:**
- Admin enables a channel, completes OAuth (for Meta sandbox app in dev Meta Developer account), returns to admin with `has_secrets=true`
- "Test connection" returns green checkmark (ok) or red error with message
- Admin log entries `channel_connected`, `channel_config_updated` fire on each action
- Channels list shows correct enabled/disabled state with last-sync timestamp when set

**Verification:**
- Dev: navigate to `/admin/channels`, click through each channel's detail page, confirm placeholder OAuth flows render
- Prod: Meta sandbox OAuth — complete full handshake, confirm `secrets_ciphertext` populated in DB, `testConnection` returns `ok:true`

## Phase 3 — Adapter abstraction + Meta Catalog pilot (M)

**Scope:** Implement the Meta Catalog adapter (pilot). Meta Catalog powers Instagram Shopping, Facebook Shop, and WhatsApp Catalog from a single catalog ID — publishing here unlocks three surfaces for one integration. Implement `publish`, `update`, `remove`, `testConnection`. Wire the Product form's Publish panel for Meta Catalog only. Build the worker edge function.

**Files to create:**
- `supabase/functions/_shared/channelAdapters/meta_catalog.ts`
- `supabase/functions/_shared/channelMappers/meta_catalog.ts` — Meta Catalog product spec: currency, price (in paise), image_url, availability, brand, condition, GTIN if present
- `supabase/functions/channel-publish-worker/index.ts`
- `src/components/admin/ChannelPublishPanel.tsx`
- `src/components/admin/ChannelStatusBadge.tsx`
- `supabase/migrations/20260420_21_channel_cron.sql` — schedules worker

**Files to modify:**
- `src/components/pages/admin/AdminProductForm.tsx` — embed `ChannelPublishPanel` below media section
- `src/components/lib/sdk.ts` — `channelPublishService.enqueue`, `.statusesForProduct`, `.listJobs`

**Meta Catalog specifics:**
- Uses Facebook Graph API `/{catalog_id}/products` endpoint
- Required fields: `retailer_id` (we use product.id), `availability` ('in stock' / 'out of stock' from `stock_quantity`), `brand`, `category`, `description`, `image_url`, `name`, `price`, `currency`, `condition`
- Image fallback: first entry of `product.images[]`; additional_image_link for others
- Update strategy: if `payload_hash` unchanged since last `last_synced_at`, skip
- WhatsApp Catalog syncs automatically from Meta Catalog; Instagram Shopping reads from the same catalog

**Acceptance criteria:**
- Publishing a product to Meta Catalog yields a Meta product ID within 60s under normal latency
- Product admin shows "Synced" badge with listing URL (link to Meta Business Manager catalog page for that product)
- `product_channel_status.listing_url` populated
- Re-clicking publish with no changes → `payload_hash` matches, no API call made, job succeeds instantly
- `update` action re-publishes only when payload changed
- `remove` deletes from Meta Catalog

**Verification:**
- Dev: UI + mocks, async success after 2s
- Prod: with a Meta sandbox catalog, publish 1 product → confirm in Meta Business Manager; change title, re-publish, confirm Meta updated; remove, confirm deletion
- Check WhatsApp Catalog viewer in WhatsApp Business app within ~15 min (Meta's propagation delay) — product should appear

## Phase 4 — Publish queue + retries + bulk publish + scheduling (L)

**Scope:** Finish the worker (exponential backoff, `SKIP LOCKED`, idempotency via `payload_hash`); bulk publish dialog triggered from product list with multi-select; schedule picker (now / +N hours / specific datetime); jobs page with filters + cancel + retry. Admin email when a job permanently fails (max_attempts reached).

**Files to create:**
- `src/components/pages/admin/AdminChannelJobs.tsx`
- `src/components/admin/BulkPublishDialog.tsx`
- `src/components/admin/SchedulePickerPopover.tsx`

**Files to modify:**
- `src/components/pages/admin/AdminProducts.tsx` — add row checkboxes + bulk action toolbar
- `supabase/functions/channel-publish-worker/index.ts` — backoff logic + admin alert email on permanent failure
- `src/components/lib/sdk.ts` — `bulkEnqueue`, `retry`, `cancelScheduled`, `listJobs`

**Acceptance criteria:**
- Scheduling a publish 10 min in future executes within 60s of target
- Failed job retries twice (after 30s, 60s) then transitions to `failed` with admin email sent via Resend
- Bulk publish of 50 products enqueues 50 jobs but worker drains sequentially without duplicates (cap 3 concurrent per channel)
- Canceling a `queued` job transitions to `cancelled`; `running` jobs cannot be cancelled mid-flight

**Verification:**
- Dev: enqueue 10 jobs, observe in mock jobs list with sequential state transitions
- Prod: schedule 5 products × 2 channels = 10 jobs for +2 min; monitor `channel_publish_jobs` status transitions; confirm all reach `succeeded` or `failed` within the window
- Induce a failure (bad token), observe retry pattern; permanent-failure admin email arrives

## Phase 5 — Remaining channels, incrementally (L per 2 channels)

**Scope:** Add remaining adapters in priority order:
1. Instagram (uses Meta Graph; reads from same catalog — adapter is light)
2. WhatsApp Catalog (automatic from Meta Catalog — adapter mostly a status mirror)
3. Pinterest
4. Google Merchant Center
5. IndiaMART (B2B-focused — requires MOQ and bulk-tier fields)
6. Amazon Seller (requires seller onboarding — gate on availability)
7. Flipkart Seller (same as Amazon)

Each channel is a constrained code change: new adapter file + new mapper + registry entry flip.

**Files to create (per channel):**
- `supabase/functions/_shared/channelAdapters/<channel>.ts`
- `supabase/functions/_shared/channelMappers/<channel>.ts`

**Files to modify:** `src/components/lib/channelRegistry.ts` (flip `supports` for the new channel)

**Acceptance criteria (per channel):**
- `testConnection` returns `ok:true` against sandbox
- One successful `publish`, one `update`, one `remove`
- One induced failure that hits retry path

**Verification:** per-channel sandbox account; track readiness in a checklist (external doc, not code)

**Notes on harder channels:**
- **IndiaMART** requires new product fields: `moq` (minimum order quantity), `bulk_price_tiers` (JSONB array of `{min_qty, price}`). Add these to the `products` table in Phase 5.1 before the IndiaMART adapter
- **Amazon / Flipkart** require seller onboarding flows outside our control — ship the adapter skeleton, document manual onboarding as a prerequisite
- **Rate limits** (especially IndiaMART) — per-channel `rate_limit_per_minute` in `channel_integrations.config`; worker enforces via a token bucket

## Open questions (for later phases)

- Existing Meta Business / Google Merchant accounts, or do we need to create new ones? (Answered in Phase 2 OAuth flow when admin attempts to connect)
- Auto-unpublish on `is_active='inactive'`: default to **no** — explicit admin action. Revisit after Phase 3 user feedback
- Permanent-failure admin email recipient: use `admin_email` env var — configurable via `app_settings.permanent_failure_alert_email`
- Scheduling suggestions ("best time to post"): out of scope; raw datetime only
- Supabase Vault vs pgcrypto: decided in Phase 1 based on project plan

## Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| OAuth token expiry | Each adapter calls `refreshTokenIfNeeded(secrets)` on every invocation; failure → mark integration `last_error` and flag UI |
| Platform API breakage | Adapter contract isolates impact; `channel_adapter_version` in registry so outdated mappers are visible |
| Rate limits → mass failures | Per-channel rate bucket in `config.rate_limit_per_minute`; retries use jitter |
| Secret leakage in logs | Adapters must never log full secrets; test-connection redacts; add ESLint rule / review checklist |
| Bulk publish stampede | Per-channel concurrency cap of 3 in worker; remaining stay `queued` |
| OAuth CSRF | `channel_oauth_state` token with 10-min TTL + admin_email binding + state validation in callback |
| Data mapping mismatches (e.g. GMC requires GTIN we lack) | Per-channel validator in mapper; `channel_publish_jobs.error_message` surfaces missing fields with actionable guidance in admin UI |
| Encryption key rotation | SQL function `rotate_channel_secret_key(old_key, new_key)` re-encrypts all rows in one transaction — Phase 5 nice-to-have |

## Effort rollup

| Phase | Effort |
|-------|--------|
| 1 | M |
| 2 | L |
| 3 | M |
| 4 | L |
| 5 | L (per 2 channels) |

---

# Cross-Feature Notes

## Order of execution (recommended)

There is no hard dependency between the three features — they can ship in parallel. That said:

- **Feature 2 Phase 1** (atomic stock reservation) is the highest-priority bug fix because overselling is a production risk today
- **Feature 1 Phase 2** (formula + recalc) should ship before Feature 2 Phase 4 so the MTO quote function can reuse the same pricing formula
- **Feature 3 Phase 2** (Channels UI) can ship at any time — no dependencies

Suggested sequence: **F2.1 → F1.1 → F1.2 → F2.2 → F3.1 → F3.2 → F2.3 → F1.3 → F3.3 → F2.4 → F1.4 → F3.4 → F2.5 → F1.5 → F3.5**

## Critical files to read before starting any phase

- `/Users/harisharaju/Documents/digitaljems/src/components/lib/sdk.ts` — all backend calls
- `/Users/harisharaju/Documents/digitaljems/supabase/schema.sql` — full schema
- `/Users/harisharaju/Documents/digitaljems/src/components/types/index.ts` — all shared types
- `/Users/harisharaju/Documents/digitaljems/src/components/pages/admin/AdminProductForm.tsx` — touched by Features 1 and 3
- `/Users/harisharaju/Documents/digitaljems/src/App.tsx` — routing
- `/Users/harisharaju/Documents/digitaljems/src/components/pages/admin/AdminLayout.tsx` — admin nav
- `/Users/harisharaju/Documents/digitaljems/src/components/pages/CheckoutPage.tsx` — touched by Feature 2

## Testing conventions

The project has no test suite today (per `CLAUDE.md`). Each phase's verification section describes manual checks. If a test suite is added later, prioritize:
- RLS regression tests (Feature 2 Phase 5)
- Race-condition test for `reserve_product_stock` (Feature 2 Phase 1)
- Formula rounding parity between SQL and JS preview (Feature 1 Phase 2)
- Worker idempotency via `payload_hash` (Feature 3 Phase 3)
