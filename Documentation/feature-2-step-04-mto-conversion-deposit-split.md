# Feature 2, Phase 4 — Out-of-Stock → MTO Conversion + Deposit Split

**Feature:** End-to-End Custom Order Pipeline  
**Status:** Done  
**Difficulty:** L (Large)

---

## The Problem We're Solving

After Phases 1–3, the checkout enforces atomic stock reservation (`reserve_product_stock` RPC). But when a product has `allow_mto=true` and `mto_required=true` comes back from the RPC, the Phase 1 code just shows an error toast and aborts. Customers can't actually place a made-to-order.

Two sub-problems:

1. **No MTO checkout path.** Stock-exhausted MTO items need a different payment flow: customer pays only a deposit upfront; the final payment arrives later when the piece is ready.

2. **No deposit-split tracking.** Regular order payment is a single `payment_id`. MTO needs two Razorpay interactions — deposit now, final invoice later — tracked in a `payment_split` JSONB column on the order row.

---

## The Solution

### 1. Dialog-based checkout pause

`handlePlaceOrder` runs async in a loop. When it encounters `mto_required=true`, it can't just show a UI and resume from where it left off (async functions don't suspend). Instead:

- When MTO is detected, save the form data + item + already-reserved items in **`mtoContext`** state.
- Show `MTOConfirmDialog` with lead time and split amounts.
- The main handler returns immediately (`setIsSubmitting(false); return`).
- If the customer accepts, **`handleMTOAccept`** picks up from `mtoContext` and runs the full MTO flow.
- If the customer cancels, **`handleMTOCancel`** releases already-reserved items.

This is the same pattern a bank uses for 2FA interrupts: pause the main flow, resume via a secondary callback.

### 2. OrderPaymentSplit JSONB

The `payment_split` column on `orders` tracks two payments as a structured object:

```json
{
  "deposit": { "amount": 25000, "status": "paid", "payment_id": "pay_XYZ", "paid_at": "2026-04-19T..." },
  "final":   { "amount": 25000, "status": "not_due" }
}
```

`status` for `final` can be `"not_due"` (before the admin sends the invoice), `"pending"` (invoice sent), or `"paid"`.

### 3. MTO fields on products

Admins can now toggle `allow_mto`, set `mto_lead_time_weeks`, and override the deposit % per product (blank = use global `app_settings` default of 50%).

### 4. Admin "Send Final Invoice"

On `AdminOrderDetail`, MTO orders show a **Payment Split** card. The "Send Final Invoice" button fires `FinalInvoiceDialog`, which calls `orderService.updateOrderStatus(order.id, 'mto_ready_for_dispatch')` and logs the action. In production this would also trigger a Razorpay payment link email to the customer.

---

## Key Concepts

| Concept | What it is | Where it appears |
|---------|-----------|-----------------|
| Dialog-based async pause | Save async context to state; resume via a callback | `CheckoutPage.tsx` — `mtoContext` state, `handleMTOAccept` |
| Split payment ledger | Two `payment_id` fields tracked in one JSONB column | `orders.payment_split`, `OrderPaymentSplit` type |
| `createMTOOrder` | Creates order with `mto_awaiting_deposit` status and `payment_split` pre-populated | `sdk.ts orderService` |
| `updateMTODepositPaid` | Updates deposit entry in `payment_split` and advances status to `mto_in_production` | `sdk.ts orderService` |
| MTO deposit % resolution | Product-level override → global `app_settings` default → hardcoded 50% | `mto-quote` edge function |
| `customJobService.createMTO` fix | Was sending `customer_email: ""` — now takes `customerInfo` parameter | `sdk.ts customJobService` |

---

## Coding Concepts Used

| Concept | What it is | Where it appears |
|---------|-----------|-----------------|
| Discriminated union narrowing | TypeScript narrows `"pending" \| "paid" \| "not_due"` inside conditionals | `AdminOrderDetail.tsx` payment split display |
| Interface over intersection | Separate `deposit` / `final` shapes instead of `Entry & { ... }` intersection | `OrderPaymentSplit` in `types/index.ts` |
| `as Order["payment_status"]` cast | Literal string in dev mock needs explicit cast for assignability | `sdk.ts createMTOOrder` dev branch |
| Async context save-and-resume | State holds `{ checkoutData, mtoItem, reservedItems }` across render cycle | `CheckoutPage.tsx` — `mtoContext` |

---

## Changes Made

### New files

| File | Purpose |
|------|---------|
| `src/components/checkout/MTOConfirmDialog.tsx` | Dialog: shows lead time, deposit/final split; Accept / Cancel |
| `src/components/admin/FinalInvoiceDialog.tsx` | Admin dialog: sends final payment invoice, advances order status |
| `supabase/functions/mto-quote/index.ts` | Edge function: resolves deposit % from product → app_settings → default |

### Modified files

| File | Change |
|------|--------|
| `src/components/types/index.ts` | Add `OrderPaymentSplit`; add `custom_job_id`/`payment_split` to `Order`; add MTO fields to `ProductFormData`; add `'mto_converted'` to `AdminActionType` |
| `src/components/lib/sdk.ts` | Fix `createMTO` empty `customer_email`; add `createMTOOrder`, `updateMTODepositPaid` to `orderService` |
| `src/components/pages/CheckoutPage.tsx` | Replace MTO placeholder with real dialog flow; add `handleMTOAccept`, `handleMTOCancel` |
| `src/components/pages/CartPage.tsx` | Add "Made-to-order eligible" badge when `stock < qty && allow_mto` |
| `src/components/pages/admin/AdminOrderDetail.tsx` | Add MTO Payment Split card + FinalInvoiceDialog |
| `src/components/pages/admin/AdminProductForm.tsx` | Add MTO section: `allow_mto` toggle, lead time, deposit % inputs |

---

## MTO Checkout Flow

```
reserve(product_id, qty) → mto_required=true
  ↓
setMtoContext({ checkoutData, mtoItem, reservedItems })
setMtoDialogOpen(true)
return  ← handlePlaceOrder exits here

[MTOConfirmDialog shown]
  ↓ Accept
handleMTOAccept()
  → createMTOOrder(checkoutData, items, totals, depositAmount)
  → initiatePayment({ amount: depositAmount * 100, ... })
  → updateMTODepositPaid(order.id, paymentId, depositAmt, finalAmt)
  → createMTO(product_id, order_id, customerInfo, spec)
  → navigate(/order-confirmation/:orderNumber)
```

---

## Interview Answer

> "MTO checkout presented a state management challenge: the async `handlePlaceOrder` function needs to pause mid-loop when it detects an out-of-stock MTO item, show a confirmation dialog, then resume only if the customer accepts. Since you can't truly pause an async function and resume from the same point, I saved the checkout context — validated form data, the triggering cart item, and already-reserved items — into React state. The dialog close callback (`handleMTOAccept`) picks up that saved context and completes the flow. This is the same pattern as a 2FA interrupt: you checkpoint your state, hand control to the UI, and resume via a second handler. The deposit split is tracked in a `payment_split` JSONB column on the order row, so both the deposit and final payment have their own `payment_id`, `status`, and `paid_at` fields without requiring a separate payments table."

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/checkout/MTOConfirmDialog.tsx` | Created |
| `src/components/admin/FinalInvoiceDialog.tsx` | Created |
| `supabase/functions/mto-quote/index.ts` | Created |
| `src/components/types/index.ts` | Modified — `OrderPaymentSplit`, `Order`, `ProductFormData`, `AdminActionType` |
| `src/components/lib/sdk.ts` | Modified — `createMTO` fix, `createMTOOrder`, `updateMTODepositPaid` |
| `src/components/pages/CheckoutPage.tsx` | Modified — full MTO dialog flow |
| `src/components/pages/CartPage.tsx` | Modified — MTO eligible badge |
| `src/components/pages/admin/AdminOrderDetail.tsx` | Modified — payment split card + FinalInvoiceDialog |
| `src/components/pages/admin/AdminProductForm.tsx` | Modified — MTO section |
| `Documentation/feature-2-step-04-mto-conversion-deposit-split.md` | Created |
