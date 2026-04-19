# Feature 2, Phase 1 — Schema + Vendors CRUD + Atomic Stock

**Feature:** End-to-End Custom Order Pipeline  
**Status:** Done  
**Difficulty:** M (Medium)

---

## The Problem We're Solving

Two separate bugs are fixed in this phase:

**Bug 1 — Overselling.** `stock_quantity` is never decremented at checkout. Two buyers can each pay for the last ring at the same moment:

```
Buyer A reads stock_quantity = 1 → "available"
Buyer B reads stock_quantity = 1 → "available"
Buyer A creates order → success
Buyer B creates order → success  ← both paid, only 1 item exists
```

This is a classic **read-then-write race condition** — a gap between the check and the update where another transaction sneaks in.

**Bug 2 — No karigar registry.** Custom jobs have no way to track which workshop is making the piece. Phase 1 builds the vendor (karigar) registry that all later phases depend on.

---

## Why a Client-Side Check Doesn't Fix the Race Condition

The naive fix is to check stock in JavaScript before calling `createOrder()`:

```typescript
// This does NOT fix overselling:
const product = await productService.getProductById(id);
if (product.stock_quantity < qty) throw new Error("out of stock");
await orderService.createOrder(...);  // stock still not decremented!
```

This has two problems:
1. **Still a gap.** Another request could run between the check and the `createOrder`.
2. **Doesn't decrement.** Even if the check passes, stock is never reduced.

You need the read **and** the write to happen atomically — inside one database transaction. That's what a Postgres RPC does.

---

## The Fix: Postgres RPC + FOR UPDATE Lock

The `reserve_product_stock` function runs on the database and does everything in one atomic unit:

```sql
-- Called via supabase.rpc('reserve_product_stock', {...})
CREATE OR REPLACE FUNCTION reserve_product_stock(p_product_id UUID, p_qty INT)
RETURNS TABLE(reserved INT, remaining INT, mto_required BOOLEAN) AS $$
DECLARE
  v_stock INT;
  v_allow_mto BOOLEAN;
BEGIN
  -- FOR UPDATE locks the row — no other transaction can read or modify it
  -- until this function commits. This closes the race window.
  SELECT stock_quantity, allow_mto INTO v_stock, v_allow_mto
  FROM products WHERE id = p_product_id FOR UPDATE;

  IF v_stock >= p_qty THEN
    UPDATE products SET stock_quantity = stock_quantity - p_qty WHERE id = p_product_id;
    RETURN QUERY SELECT p_qty, v_stock - p_qty, FALSE;
  ELSIF v_allow_mto THEN
    -- Out of stock but made-to-order is allowed (handled in Phase 4)
    RETURN QUERY SELECT 0, v_stock, TRUE;
  ELSE
    RAISE EXCEPTION 'Insufficient stock and MTO not allowed';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Why this works:**
- `FOR UPDATE` acquires a row-level lock. Buyer B's query waits at the `SELECT` line until Buyer A's function commits.
- Buyer A commits: stock goes from 1 → 0.
- Buyer B's lock releases, reads stock = 0 → exception → order rejected.
- Both the check and the decrement are inside the same transaction.

```
Timeline with RPC:
Buyer A: SELECT ... FOR UPDATE (lock acquired)
Buyer B: SELECT ... FOR UPDATE (blocked — waiting for lock)
Buyer A: UPDATE stock = 0 → COMMIT (lock released)
Buyer B: (resumes) reads stock = 0 → EXCEPTION → 409 error
```

---

## Key Concepts

### Postgres RPC (Remote Procedure Call)
A SQL function stored in the database and callable via the Supabase client:
```typescript
// Client code — sends one HTTP request, DB runs atomically
const { data, error } = await supabase.rpc("reserve_product_stock", {
  p_product_id: product_id,
  p_qty: qty
});
```
The advantage over inline SQL: the entire function body executes in one database round-trip with consistent transaction semantics. You can't do `FOR UPDATE` in a Supabase `.update()` call.

### FOR UPDATE (Row-Level Lock)
A `SELECT ... FOR UPDATE` locks the selected rows until the transaction ends. Any other transaction that tries to `SELECT ... FOR UPDATE` the same rows will **block** (wait) rather than proceed with stale data. This is the mechanism that closes the race window.

### Stock Release on Failure
When payment fails (cancelled, gateway error) or an unexpected exception occurs, `release_product_stock` restores the stock. This is important: we reserve before creating the order so that inventory is always consistent with payment state.

```
Reserve → Create Order → Initiate Payment
            ↓ failure ↓
         Release stock (restore)
```

---

## Coding Concepts Used

| Concept | What it is | Where it appears |
|---------|-----------|-----------------|
| **Row-level lock** | `SELECT ... FOR UPDATE` — blocks concurrent reads-for-update on the same row | `reserve_product_stock` RPC |
| **Atomicity** | All-or-nothing: the check, decrement, and return happen as one DB transaction | Inside the RPC |
| **RPC** | A Postgres function called via `supabase.rpc()` — runs server-side | `stockService.reserve()` and `.release()` |
| **Early return pattern** | Check each reservation; abort + release partial reservations on the first failure | `handlePlaceOrder` loop |
| **`.catch(() => {})` suppression** | Swallow errors from cleanup calls that run in error paths — we don't want cleanup to mask the original error | Release calls in catch/finally |
| **Dev mode mutation** | `stockService.reserve` in dev mode mutates `DEV_PRODUCTS[idx].stock_quantity` directly, simulating the RPC | `isDev` branch |
| **Optional chaining on type extension** | `product.allow_mto` is optional (`allow_mto?: boolean`) so existing dev products without it evaluate to `undefined` → falsy | `Product` interface |

---

## Changes Made

### 1. `src/components/types/index.ts` — new and extended types

```typescript
// Product: MTO fields (new columns added to DB)
export interface Product {
  // ... existing fields ...
  allow_mto?: boolean;          // CONCEPT: optional — existing products won't have this
  mto_lead_time_weeks?: number;
  mto_deposit_pct?: number;
}

// OrderStatus: MTO states
export type OrderStatus =
  | "placed" | "confirmed" | "processing" | "shipped"
  | "delivered" | "cancelled" | "payment_failed"
  | "mto_awaiting_deposit"      // CONCEPT: extended union — new states for Phase 4
  | "mto_in_production"
  | "mto_ready_for_dispatch";

// AdminActionType: vendor audit actions
export type AdminActionType =
  | "product_created" | ... | "request_responded"
  | "vendor_created"            // CONCEPT: union extension
  | "vendor_updated";

// AdminLog.entity_type: extended
entity_type: "product" | "order" | "request" | "vendor";

// New: Vendor registry types
export type VendorSpecialty = "casting" | "stone_setting" | "polishing" | "cad" | "engraving" | "assembly";

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
```

---

### 2. `src/components/lib/sdk.ts` — three new services

**`vendorService`** — CRUD for karigar registry. Dev mock mutates `DEV_VENDORS[]`.

**`stockService`:**
```typescript
export const stockService = {
  async reserve(product_id: string, qty: number): Promise<{ reserved: number; remaining: number; mto_required: boolean }> {
    if (isDev) {
      const idx = DEV_PRODUCTS.findIndex(p => p.id === product_id);
      const product = DEV_PRODUCTS[idx];
      if (product.stock_quantity >= qty) {
        DEV_PRODUCTS[idx] = { ...product, stock_quantity: product.stock_quantity - qty };
        return { reserved: qty, remaining: product.stock_quantity - qty, mto_required: false };
      } else if (product.allow_mto) {
        return { reserved: 0, remaining: product.stock_quantity, mto_required: true };
      } else {
        throw new Error(`Insufficient stock for "${product.name}"`);
      }
    }
    // CONCEPT: single RPC call replaces read-check-write with one atomic DB operation
    const { data, error } = await supabase.rpc("reserve_product_stock", { p_product_id: product_id, p_qty: qty });
    if (error) throw error;
    return (data as ...)[0];
  },

  async release(product_id: string, qty: number): Promise<void> { ... }
};
```

**`appSettingsService`** — key/value settings table. Dev mock reads/writes `DEV_SETTINGS`.

---

### 3. `src/components/pages/CheckoutPage.tsx` — atomic reservation before order

```typescript
const handlePlaceOrder = async () => {
  ...
  const reservedItems: { product_id: string; qty: number }[] = [];

  try {
    // CONCEPT: reserve all items before creating the order
    for (const item of items) {
      let result;
      try {
        result = await stockService.reserve(item.product.id, item.quantity);
      } catch (err) {
        // Partial rollback: release any already-reserved items
        for (const ri of reservedItems) {
          await stockService.release(ri.product_id, ri.qty).catch(() => {});
        }
        toast({ title: "Item unavailable", ... });
        return;
      }
      if (result.mto_required) {
        // Out of stock, MTO handled in Phase 4
        for (const ri of reservedItems) { ... release ... }
        return;
      }
      reservedItems.push({ product_id: item.product.id, qty: item.quantity });
    }

    const order = await orderService.createOrder(...);
    const paymentResult = await initiatePayment(...);

    if (!paymentResult.success) {
      await orderService.updateOrderStatus(order.id, "payment_failed");
      // CONCEPT: release on payment failure — stock restored so another buyer can purchase
      for (const ri of reservedItems) {
        await stockService.release(ri.product_id, ri.qty).catch(() => {});
      }
      return;
    }
    ...
  } catch (error) {
    // Release on unexpected error
    for (const ri of reservedItems) { ... release ... }
    ...
  }
};
```

---

### 4. Admin: Vendors UI

**`AdminVendors.tsx`** — list with search, specialty badges, reliability score, archive button.  
**`AdminVendorForm.tsx`** — create/edit form with multi-select specialties (toggle badges).  
**`AdminLayout.tsx`** — added `{ path: "/admin/vendors", icon: Users, label: "Vendors" }` nav item.  
**`App.tsx`** — added `vendors`, `vendors/new`, `vendors/:id/edit` routes.

---

## What You'll Learn

| Concept | Why It Matters |
|---------|---------------|
| Row-level locking | The fundamental primitive for preventing double-spending, double-booking, and overselling. |
| Atomic read-modify-write | Any time you "check then act", consider whether a race window exists. Use a transaction or RPC to close it. |
| Partial rollback pattern | When reserving multiple resources sequentially, track what you've acquired and release on failure. |
| Cleanup in error paths | `stockService.release()` is called in three places: reservation failure, payment failure, and unexpected exception. Each path is independent. |
| Database functions vs. ORM calls | Some logic (locking, conditional updates) can only be expressed correctly in SQL. RPCs are the escape hatch. |

---

## Interview Answer

> "To prevent overselling, you need the stock check and decrement to happen atomically. A read-then-write in application code has a race window: two buyers both read `stock = 1`, both pass the check, and both decrement. The fix is a Postgres function that uses `SELECT ... FOR UPDATE` — this acquires a row-level lock so concurrent calls serialize rather than interleave. The second caller blocks at the SELECT until the first commits, at which point it reads the updated (possibly zero) stock and rejects accordingly. On payment failure, a `release_product_stock` RPC restores the quantity, keeping inventory consistent with payment state."

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/types/index.ts` | Added `Vendor`, `VendorSpecialty`; extended `OrderStatus`, `AdminActionType`, `AdminLog.entity_type`; added MTO fields to `Product` |
| `src/components/lib/sdk.ts` | Added `DEV_VENDORS`, `DEV_SETTINGS`; added `vendorService`, `stockService`, `appSettingsService` |
| `src/components/pages/admin/AdminLayout.tsx` | Added Vendors nav item |
| `src/App.tsx` | Added vendor routes |
| `src/components/pages/admin/AdminVendors.tsx` | Created — vendor list with search and archive |
| `src/components/pages/admin/AdminVendorForm.tsx` | Created — vendor create/edit form |
| `src/components/pages/CheckoutPage.tsx` | Added stock reservation before order creation; stock release on payment failure and errors |
| `supabase/migrations/20260420_10_custom_jobs_schema.sql` | Created — full DDL for vendors, custom_jobs, milestones, app_settings, RPCs |
| `supabase/schema.sql` | Appended new DDL as canonical reference |
