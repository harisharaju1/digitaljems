# Step 2 — Stale-While-Revalidate Caching

**System design concept:** Cache Strategies (Cache-Aside, SWR, Write-Through)
**Status:** Done
**Difficulty:** Beginner

SWR (Stale-While-Revalidate) is predominantly a data-fetching strategy used on the client-side (like React apps) or edge/CDNs. When an application requests data, SWR will immediately return the "stale" cached data to the user to ensure a fast UI response, while simultaneously making a background request to the database/API to fetch the freshest data and update the cache.
#### How they compare:
**SWR vs. Cache-Aside:** While both strategies populate the cache based on read requests, Cache-Aside forces the user to wait for the database fetch if the cache is expired or missing. SWR prioritizes immediate rendering by returning stale data first, masking the database fetch latency entirely from the user's perspective.
**SWR vs. Write-Through:** Write-Through is primarily a backend architecture choice focused on safely writing data to ensure 100% consistency between memory and the database
. SWR is heavily focused on the read experience, accepting temporary inconsistency (showing stale data for a moment) to achieve perceived zero-latency loads.

---

## The Problem We're Solving

Every time a React component mounts and calls `loadProducts()`, the app makes a full network round-trip to Supabase — even if it fetched the exact same data 3 seconds ago.

```
User navigates Home → loadProducts() → Supabase round-trip → wait → render
User navigates away → User navigates back → loadProducts() → Supabase round-trip → wait → render again
```

This happens because the Zustand store has no notion of *freshness*. It knows what products it has, but not *when* it got them. So every mount triggers a fresh fetch, even when nothing has changed.

At scale this means:
- Unnecessary database queries on every page visit
- A visible loading flash on navigation even when the data is identical
- Wasted bandwidth serving the same 12 products repeatedly to the same user

---

## Why Not Just Always Re-fetch? (The Problem with No Cache)

The naive approach is what we already have: fetch on every mount, always. It's simple — but it treats the network as free and instant, which it isn't.

**The analogy:** Imagine you have a whiteboard in your office showing today's product prices. Every time a colleague walks in and asks "what's the price of gold today?", you pick up the phone, call your supplier, wait on hold, get the price, write it down, then answer. Even if someone else asked the same question 30 seconds ago and the answer is already on the whiteboard.

The whiteboard is your cache. Ignoring it and calling every time is wasteful — the price hasn't changed, but you paid the cost of the call anyway.

**The hidden cost:** In DigitalJems, Supabase has a free-tier request limit. Every redundant fetch counts against it. More importantly, the user sees a loading skeleton even when the data is identical to what they saw 10 seconds ago — that's a bad experience that a cache eliminates entirely.

---

## The Fix: Stale-While-Revalidate (SWR)

SWR is a caching strategy with three states for any cached value:

```
MISSING  → No data at all. Fetch now, show loading state.
FRESH    → Data exists and is recent (< TTL). Return it immediately, skip fetch.
STALE    → Data exists but is old (> TTL). Return it immediately AND fetch in background.
```

The key insight of SWR: **stale data is better than no data**. The user sees something instantly. The fresh data arrives shortly after and updates the UI silently.

**The analogy:** Think of SWR like a newspaper on your doorstep. If today's paper is there, you read it immediately — even if it's from this morning and the world has changed since. While you read, someone is already printing tomorrow's edition. When it arrives, you swap it in without interrupting your morning.

```
Without cache:    request → wait 500ms → render           (user sees blank every time)
With SWR (fresh): cache hit → render immediately          (0ms wait)
With SWR (stale): cache hit → render immediately          (0ms wait)
                  + background fetch → silent update      (no interruption)
```

**The TTL (Time To Live):** We use 60 seconds for the product list. If the data is younger than 60s, it's "fresh" and we skip the fetch. Older than 60s, it's "stale" — we still show it, but trigger a background re-fetch.

---

## What "Stale-While-Revalidate" Actually Is

Here's the concrete flow with DigitalJems data:

```
10:00:00 — User visits homepage for the first time
  cache.get("products:page1") → null (MISSING)
  → fetch from Supabase → 12 products returned
  → cache.set("products:page1", { products, cachedAt: 10:00:00 })
  → set products in Zustand store → render

10:00:30 — User navigates to a product, then navigates back (30s later)
  cache.get("products:page1") → { products, cachedAt: 10:00:00 }
  cache.isStale("products:page1", 60s) → false (only 30s old = FRESH)
  → return cached products immediately → render (0ms wait, no network call)

10:01:30 — User navigates away and back again (90s since first load)
  cache.get("products:page1") → { products, cachedAt: 10:00:00 }
  cache.isStale("products:page1", 60s) → true (90s old = STALE)
  → return cached products immediately → render (0ms wait)
  → kick off background fetch → new data arrives → silent update

10:02:00 — Admin creates a new product
  productService.createProduct(...)
  cache.invalidate("products:page1")  ← event-based invalidation
  → next loadProducts() call fetches fresh (cache is now MISSING again)
```

The user never sees a loading state for repeat visits. The admin's new product shows up on the next navigation after creation.

---

## Configuring the TTL Without Touching Code

The TTL values (how long data is considered "fresh") are controlled via environment variables — no code change needed to tune them.

**Locally** — add to your `.env` file and restart the dev server:
```
VITE_PRODUCTS_LIST_CACHE_TTL_MS=60000    # 60 seconds (default)
VITE_PRODUCT_DETAIL_CACHE_TTL_MS=300000  # 5 minutes (default)
```

**On Vercel** — go to Project Settings → Environment Variables, add the key/value, then redeploy. That's it.

All env var reads are centralized in `src/components/lib/config.ts` — nothing reads `import.meta.env` directly. This is the Vite equivalent of `appsettings.json` in .NET:

```typescript
// src/components/lib/config.ts
export const config = {
  cache: {
    productsListTtlMs:  envInt("VITE_PRODUCTS_LIST_CACHE_TTL_MS",  60_000),
    productDetailTtlMs: envInt("VITE_PRODUCT_DETAIL_CACHE_TTL_MS", 300_000),
  },
};
```

If the env var is missing or not a valid number, `envInt()` falls back to the default — so the app always works even if the variable isn't set.

**Why centralize in `config.ts`?** If you read `import.meta.env.VITE_*` scattered across 10 files, finding and changing a value means grepping the whole codebase. With `config.ts`, there is one file to look at, one place to add a new tunable, and one place where bad/missing env vars are caught.

---

## Where the Cache Actually Lives

The cache is stored in the **browser's JavaScript memory (RAM)** — specifically, the `Map` object inside `cache.ts` lives in the module's memory scope for as long as the tab is open.

```typescript
// src/components/lib/cache.ts
const store = new Map<string, CacheEntry>(); // ← lives in JS heap memory
```

| Event | Cache survives? |
|-------|----------------|
| Navigate between pages | ✅ Yes — same tab, same memory |
| Switch tabs and come back | ✅ Yes |
| Page refresh (F5) | ❌ No — memory is wiped, next `loadProducts()` hits the MISSING path |
| Close and reopen tab | ❌ No |

This is intentional. The cache is a *session-level* performance layer — it prevents redundant re-fetches *within* a browsing session. It is not meant to be durable.

**There are actually two separate storage layers in the app after this step:**

```
localStorage  (via Zustand persist)
  └── key: "products-storage"
  └── what: the products array itself
  └── survives: page refresh ✅

In-memory Map  (the cache module)
  └── key: "products:page1"
  └── what: the products + timestamp (for TTL check)
  └── survives: page refresh ❌
```

After a refresh, Zustand rehydrates `products` from localStorage so the user doesn't see an empty grid. But the cache Map is empty — so `loadProducts()` goes through the MISSING path, re-fetches from Supabase, and populates the cache with a fresh timestamp for the rest of that session.

---

## High-Level Code Blocks

---

### `Map<string, CacheEntry>` (JavaScript Map)
**What it is:** A built-in JavaScript key-value store where keys can be any value (not just strings like plain objects) and iteration order is preserved. More powerful than a plain `{}` object for use as a cache.

**Why it exists:** We need to store multiple cache entries keyed by a string (like `"products:page1"` or `"product:abc123"`) and be able to look them up, add new ones, delete specific ones, and iterate over all keys — all operations `Map` handles efficiently.

**In this step:**
```typescript
// The cache's backing store — a Map where each key is a cache key string
// and the value is the cached data plus the timestamp it was cached.
const store = new Map<string, { data: unknown; cachedAt: number }>();
//                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                    TypeScript generic: key is string, value has this shape
```

---

### Generic function (`get<T>`)
**What it is:** A function with a type parameter `<T>` that lets the caller tell TypeScript what type to expect back. The function works the same at runtime; the generic is purely a compile-time hint.

**Why it exists:** Without generics, `cache.get("products:page1")` would return `unknown`, and you'd need a cast everywhere. With `<T>`, TypeScript knows the return type matches what you put in.

**In this step:**
```typescript
// <T> is a type parameter — the caller specifies what type they expect.
// cache.get<Product[]>("products:page1") returns Product[] | null
// cache.get<Product>("product:abc")     returns Product | null
function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  return entry.data as T; // safe cast — we trust what was set earlier
}
```

---

### Module-level singleton (`export const cache`)
**What it is:** A single instance of the cache object created once when the module is first imported. Every file that imports `cache` gets the same instance — the Map is shared across the whole app.

**Why it exists:** If each file created its own cache, they'd all have separate Maps and would never share data. A module-level singleton ensures the cache is one shared object in memory.

**In this step:**
```typescript
// This object is created once. When sdk.ts and products-store.ts both
// import { cache }, they both get a reference to this exact same object.
export const cache = {
  get<T>(key: string): T | null { ... },
  set(key: string, data: unknown): void { ... },
  isStale(key: string, ttlMs: number): boolean { ... },
  invalidate(key: string): void { ... },
};
```

---

### Floating Promise (background re-fetch)
**What it is:** A Promise that is intentionally not `await`-ed. The async work starts, but the calling function doesn't wait for it to finish — it returns immediately and the Promise resolves later on its own.

**Why it exists:** In SWR, the whole point is that the background re-fetch doesn't block the caller. If we `await`-ed it, the user would wait. By not awaiting, we kick off the work and let it finish whenever it finishes.

**In this step:**
```typescript
// We have stale data — return immediately (don't await anything)
// then start the background fetch without waiting for it.
set({ products: cached.products, ... }); // render immediately

// CONCEPT: floating Promise — .then() without await
// This starts the fetch but doesn't block the current function from returning.
productService.getAllProductsPaginated(12).then((result) => {
  cache.set(PRODUCTS_CACHE_KEY, result);
  set({ products: result.products, nextCursor: result.nextCursor, hasMore: result.hasMore });
}).catch(console.error); // always handle errors on floating Promises

return; // return immediately — the user already has their products
```

---

### `Date.now()` (timestamp as TTL anchor)
**What it is:** A JavaScript built-in that returns the current time as milliseconds since the Unix epoch (Jan 1, 1970). Subtracting two `Date.now()` values gives elapsed time in milliseconds.

**Why it exists:** We need to know *how old* a cache entry is to decide if it's stale. Storing the timestamp at write time and comparing to the current timestamp at read time gives us age.

**In this step:**
```typescript
// When setting: record the current time
cache.set(key, { data, cachedAt: Date.now() }); // e.g., 1737000000000

// When checking staleness:
function isStale(key: string, ttlMs: number): boolean {
  const entry = store.get(key);
  if (!entry) return true;
  // Date.now() - entry.cachedAt = how many milliseconds have passed
  return Date.now() - entry.cachedAt > ttlMs;
  //     ^^^^^^^^^^   ^^^^^^^^^^^^^^^^
  //     now          when we cached it
}
```

---

## Coding Concepts Used

| Concept | What it is | Where it appears |
|---------|-----------|-----------------|
| **Generic function (`<T>`)** | Type parameter that lets the caller declare the return type | `cache.get<T>()` |
| **`Map<K, V>`** | Built-in key-value store with O(1) lookup | Backing store for the cache |
| **Module singleton** | One shared instance created at import time | `export const cache = { ... }` |
| **Floating Promise** | A Promise started with `.then()` but not `await`-ed | Background re-fetch in SWR stale path |
| **`Date.now()`** | Current timestamp in milliseconds | TTL staleness check |
| **Type assertion (`as T`)** | Telling TypeScript to trust a type at a boundary | `entry.data as T` in `cache.get` |
| **Early return** | `return` before the end of a function to skip the rest | Exiting `loadProducts` when cache is fresh |
| **Nullish guard** | `if (!entry) return null` — handle the missing case before the happy path | Cache miss handling |
| **TTL constant** | A named constant for the time-to-live value | `const PRODUCTS_TTL_MS = 60_000` |
| **Numeric separator (`_`)** | `60_000` is the same as `60000` but more readable | TTL constant |

---

## How This Fits in the DigitalJems Codebase

### Current code (the problem)

**`src/components/store/products-store.ts` — `loadProducts`:**
```typescript
loadProducts: async () => {
  // CONCEPT (problem): no cache check here — always fetches, every time.
  // There is no way to know if the data is fresh or stale.
  set({ isLoading: true, error: null, products: [], nextCursor: null, hasMore: true });

  const result = await productService.getAllProductsPaginated(12);
  // Every mount triggers this network call, regardless of whether the
  // data changed since the last call.
  set({ products: result.products, ... });
},
```

**`src/components/pages/admin/AdminProductForm.tsx` — `loadProduct`:**
```typescript
const loadProduct = async (productId: string) => {
  // CONCEPT (problem): fetches ALL products just to find one by ID.
  // This is an unnecessary full scan — should use getProductById() directly.
  const products = await productService.getAllProducts();
  const product = products.find((p) => p.id === productId);
  ...
};
```

**`src/components/pages/admin/AdminProductForm.tsx` — `handleSave`:**
```typescript
await productService.updateProduct(id, dataToSave);
// CONCEPT (problem): after mutating a product, the cache is never invalidated.
// The homepage will keep showing the old product data until the TTL expires naturally.
toast({ title: "Product updated successfully" });
```

---

### What we'll add — annotated

#### 1. New file: `src/components/lib/cache.ts`

```typescript
// CONCEPT: module singleton — one Map shared across the entire app.
// All imports of `cache` reference this exact same object in memory.
const store = new Map<string, { data: unknown; cachedAt: number }>();

export const cache = {
  // CONCEPT: generic function — <T> lets the caller declare the expected type.
  // cache.get<Product[]>("products:page1") returns Product[] | null
  get<T>(key: string): T | null {
    const entry = store.get(key);
    // CONCEPT: nullish guard — handle the missing case first
    if (!entry) return null;
    return entry.data as T; // CONCEPT: type assertion — we trust what was set
  },

  set(key: string, data: unknown): void {
    // CONCEPT: Date.now() — record the exact millisecond this was cached
    store.set(key, { data, cachedAt: Date.now() });
  },

  isStale(key: string, ttlMs: number): boolean {
    const entry = store.get(key);
    if (!entry) return true; // missing = treat as stale
    // CONCEPT: elapsed time = now minus when it was cached
    return Date.now() - entry.cachedAt > ttlMs;
  },

  invalidate(key: string): void {
    store.delete(key);
  },

  // Clears all cache entries whose key starts with a prefix.
  // Used to invalidate all product-related entries at once.
  invalidateByPrefix(prefix: string): void {
    // CONCEPT: Map iteration — iterate over all keys and delete matching ones
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },
};
```

---

#### 2. Updated `loadProducts` in `src/components/store/products-store.ts`

```typescript
import { cache } from "@/components/lib/cache";

// CONCEPT: named constant with numeric separator for readability
// 60_000 milliseconds = 60 seconds TTL
const PRODUCTS_CACHE_KEY = "products:page1";
const PRODUCTS_TTL_MS = 60_000;

loadProducts: async () => {
  const cached = cache.get<{ products: Product[]; nextCursor: string | null; hasMore: boolean }>(PRODUCTS_CACHE_KEY);

  if (cached) {
    if (!cache.isStale(PRODUCTS_CACHE_KEY, PRODUCTS_TTL_MS)) {
      // CONCEPT: SWR — FRESH path. Data is < 60s old.
      // Return immediately from cache, skip the network call entirely.
      set({ products: cached.products, nextCursor: cached.nextCursor, hasMore: cached.hasMore });
      return; // CONCEPT: early return — nothing else to do
    }

    // CONCEPT: SWR — STALE path. Data is > 60s old.
    // Show stale data immediately so the user sees something at 0ms wait.
    set({ products: cached.products, nextCursor: cached.nextCursor, hasMore: cached.hasMore });

    // CONCEPT: floating Promise — kick off re-fetch in background WITHOUT awaiting.
    // The function returns to React immediately; the fetch finishes later.
    productService.getAllProductsPaginated(12).then((result) => {
      cache.set(PRODUCTS_CACHE_KEY, result);
      set({ products: result.products, nextCursor: result.nextCursor, hasMore: result.hasMore });
    }).catch(console.error); // always handle errors on floating Promises

    return; // CONCEPT: early return — user already has their products
  }

  // CONCEPT: SWR — MISSING path. No cache at all — fetch normally.
  set({ isLoading: true, error: null, products: [], nextCursor: null, hasMore: true });

  try {
    const result = await productService.getAllProductsPaginated(12);
    cache.set(PRODUCTS_CACHE_KEY, result); // populate cache for next visit
    set({ products: result.products, nextCursor: result.nextCursor, hasMore: result.hasMore, isLoading: false });
  } catch (error) {
    // ... existing retry logic unchanged ...
  }
},
```

---

#### 3. Cache on `getProductById` in `src/components/lib/sdk.ts`

```typescript
async getProductById(productId: string): Promise<Product | null> {
  const cacheKey = `product:${productId}`; // CONCEPT: template literal as dynamic cache key
  const cached = cache.get<Product>(cacheKey);

  // Individual products use a longer TTL — they change less often than the list
  if (cached && !cache.isStale(cacheKey, 300_000)) { // 5 minutes
    return cached; // CONCEPT: early return from cache
  }

  if (isDev) return DEV_PRODUCTS.find((p) => p.id === productId) || null;

  const { data, error } = await supabase
    .from("products").select("*").eq("id", productId).single();

  if (error) return null;

  const product = { ...data, images: ..., videos: ... } as Product;
  cache.set(cacheKey, product); // cache for next lookup
  return product;
},
```

---

#### 4. Cache invalidation in `src/components/pages/admin/AdminProductForm.tsx`

```typescript
import { cache } from "@/components/lib/cache";

// In handleSave(), after productService.updateProduct() or createProduct():
await productService.updateProduct(id, dataToSave);
// CONCEPT: event-based invalidation — the admin changed data, so the cache
// is now wrong. Delete it so the next loadProducts() call fetches fresh.
cache.invalidateByPrefix("products"); // clears "products:page1" and any other product list keys
cache.invalidate(`product:${id}`);   // clears the individual product cache too

// In loadProduct(), fix the wasteful getAllProducts() call:
const product = await productService.getProductById(id); // use targeted lookup, not full list
```

---

## What You'll Learn

| Concept | Why It Matters |
|---------|---------------|
| The three cache states (MISSING / FRESH / STALE) | Every caching decision maps to one of these three. SWR is just a name for "serve STALE immediately, revalidate in background." |
| TTL-based vs. event-based invalidation | TTL lets old data expire naturally. Event-based (on mutation) ensures admins see correct data immediately. Both are needed. |
| Floating Promises for background work | Any time you want to do async work without blocking the caller — background fetches, analytics, logging — this is the pattern. |
| Module singleton | The cache must be a single shared object. Modules in JavaScript are cached by the runtime — importing the same module twice gives you the same instance. |
| Cache invalidation is the hard part | The interview cliché: "there are only two hard things in CS — cache invalidation and naming things." This step shows why: you need to know *when* data changes to know *when* to invalidate. |

---

## Interview Version

> "Stale-while-revalidate is a cache strategy with three states: missing (no cached data, show a loading state and fetch), fresh (cached data is recent enough, return it without any network call), and stale (cached data exists but is older than the TTL, so return it immediately for a 0ms perceived latency, then kick off a background re-fetch that updates the UI silently when it completes). The TTL is typically short for lists — 60 seconds for product listings — and longer for individual items. Cache invalidation is handled two ways: TTL lets entries expire passively over time, and event-based invalidation clears entries immediately when a mutation happens — for example, when an admin creates a product, we delete the product list cache key so the next read fetches fresh data."

---

## Files to Touch

| File | Change |
|------|--------|
| `src/components/lib/cache.ts` | New — in-memory cache module with get, set, isStale, invalidate, invalidateByPrefix |
| `src/components/store/products-store.ts` | Wrap `loadProducts()` with SWR cache check (fresh / stale / missing) |
| `src/components/lib/sdk.ts` | Add cache to `getProductById()`; fix `getAllProducts()` in admin context |
| `src/components/pages/admin/AdminProductForm.tsx` | Invalidate cache after create/update; use `getProductById()` instead of full list fetch |
