# Step 1 — Cursor-Based Pagination

**System design concept:** Pagination (Offset vs. Cursor-Based)
**Status:** Done
**Difficulty:** Beginner

---

## The Problem We're Solving

Right now, every time the homepage loads, this is what happens:

```
User opens app → loadProducts() → "Give me ALL active products" → Supabase returns 100 rows → browser renders them all
```

This works fine with 10 or 100 products. But imagine the catalog grows to 5,000 items. You're:
- Sending 5,000 rows of data over the network on every page load
- Making the user wait for all 5,000 before seeing anything
- Throwing away 4,988 rows the user never scrolls to

Pagination solves this by fetching only what the user can actually see, then fetching more as they ask for it.

---

## Why Not Just Use "Page 1, Page 2, Page 3"? (The Problem with OFFSET)

The naive approach — and the one most developers reach for first — is **offset pagination**:

```sql
-- Page 1: skip 0, take 12
SELECT * FROM products ORDER BY created_at DESC LIMIT 12 OFFSET 0;

-- Page 2: skip 12, take 12
SELECT * FROM products ORDER BY created_at DESC LIMIT 12 OFFSET 12;

-- Page 3: skip 24, take 12
SELECT * FROM products ORDER BY created_at DESC LIMIT 12 OFFSET 24;
```

**The analogy:** Imagine you have a stack of 10,000 numbered cards, face-down. To get "page 200" (items 2,389–2,400), you must count and discard 2,388 cards before you can read the ones you want. You did 2,388 units of work to get 12 results. Every time a user goes to a later page, the database does more wasted work.

**In database terms:** `OFFSET N` tells the database to scan and discard N rows before returning results. At large offsets this is slow — even with an index, PostgreSQL still has to traverse the index tree and count past rows it doesn't need.

**The hidden bug:** If a new product is added while the user is browsing, all the page boundaries shift. The user can see duplicates (a product appears on both page 1 and page 2) or miss items entirely. This is a real data consistency problem.

---

## The Fix: Cursor-Based Pagination (Keyset Pagination)

Instead of saying "skip N rows", you say **"give me the next rows after this specific row"**.

```sql
-- First load: just get the first 12
SELECT * FROM products 
WHERE is_active = 'active'
ORDER BY created_at DESC 
LIMIT 12;

-- "Load More": get the next 12 AFTER the last one we saw
SELECT * FROM products 
WHERE is_active = 'active'
  AND created_at < '2025-01-14T10:00:00.000Z'   ← the cursor
ORDER BY created_at DESC 
LIMIT 12;
```

**The analogy:** Instead of counting cards from the top of the stack, you put a bookmark at the last card you read. Next time, you open straight to the bookmark and read forward from there — O(1) positioning, not O(N).

**Why this works with an index:** The `created_at` column is indexed. PostgreSQL can jump directly to that timestamp in the index tree (O(log N)) and start reading from there. No scanning, no discarding.

```
Performance comparison for "get page 500" with 10,000 products:

OFFSET approach:    Scan index → skip 5,988 rows → read 12    [slow, gets slower]
Cursor approach:    Jump to timestamp in index → read 12       [always fast]
```

**The consistency bonus:** New products added at the top don't shift your cursor. You always get exactly the rows after your bookmark, no duplicates, no skips.

---

## What a "Cursor" Actually Is

In DigitalJems, the cursor is simply the `created_at` timestamp of the **last product on the current page**.

```
First fetch returns:
  Product A  — created_at: "2025-01-15T10:00:00Z"   ← newest
  Product B  — created_at: "2025-01-14T10:00:00Z"
  ...
  Product L  — created_at: "2025-01-05T10:00:00Z"   ← last on page, this becomes the cursor

Next fetch uses cursor "2025-01-05T10:00:00Z":
  → WHERE created_at < "2025-01-05T10:00:00Z"
  Product M  — created_at: "2025-01-04T10:00:00Z"   ← picks up right where we left off
  ...
```

The cursor is opaque to the user — they just click "Load More". Internally it's just a timestamp we pass along.

---

## High-Level Code Blocks

Every code file is built from a set of named constructs — "blocks" that serve a specific structural purpose. Here's what each one means and why it exists, in the context of this step.

---

### `interface`
**What it is:** A TypeScript-only construct that defines the *shape* of an object — what fields it must have and what type each field must be. It doesn't produce any JavaScript at runtime; it's purely a compile-time contract that TypeScript uses to catch mistakes.

**Why it exists:** Without it, you could write `state.nexCursor` (typo) and only find out at runtime. With an `interface`, TypeScript flags the typo the moment you type it.

**In this step:**
```typescript
// Defines what the Zustand store must contain.
// TypeScript will error if you try to access a field not listed here,
// or if you assign the wrong type to one that is listed.
interface ProductsState {
  products: Product[];       // must be an array of Product objects
  nextCursor: string | null; // must be a string or null — nothing else
  hasMore: boolean;          // must be true or false
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  // ... actions listed here too, typed as functions
  loadProducts: () => Promise<void>;
  loadMoreProducts: () => Promise<void>;
}
```

---

### `async method`
**What it is:** A function marked with `async` that always returns a `Promise`. Inside it, you can use `await` to pause execution until an async operation (like a network call) completes, without blocking the rest of the app.

**Why it exists:** JavaScript is single-threaded — if you blocked waiting for a network call, the entire UI would freeze. `async/await` lets you write sequential-looking code (`const result = await fetch(...)`) while the browser continues handling other events behind the scenes.

**In this step:**
```typescript
// "async" tells JavaScript this function will do something
// that takes time (a Supabase network call).
// It automatically wraps the return value in a Promise.
async getAllProductsPaginated(limit = 12, cursor?: string) {
  // "await" pauses THIS function here until Supabase responds,
  // but does NOT freeze the browser — other code keeps running.
  const { data, error } = await query;
  return { products, nextCursor, hasMore };
}
```

---

### `export const` (service object)
**What it is:** Exports a named constant so other files can import it. In `sdk.ts`, the services are plain objects (`const productService = { method1, method2 }`) rather than classes — this is a deliberate pattern to keep them simple and tree-shakeable.

**Why it exists:** Files can't share code without importing/exporting. `export` makes the value available; `const` ensures it can't be accidentally reassigned.

**In this step:**
```typescript
// productService is one object holding all product-related API methods.
// Other files do: import { productService } from "@/components/lib/sdk"
export const productService = {
  getAllProducts(...) { ... },
  getAllProductsPaginated(...) { ... },  // ← new method added here
  getProductById(...) { ... },
  // ...
};
```

---

### `let` variable (mutable query builder)
**What it is:** Declares a variable that *can* be reassigned. Contrasts with `const`, which cannot. In TypeScript/JavaScript, prefer `const` by default — only use `let` when you know you'll need to reassign.

**Why it exists here:** The Supabase query builder is built up step by step. We start with a base query, then conditionally attach the cursor filter. Since we might reassign `query`, it must be `let`.

**In this step:**
```typescript
// "let" because we may reassign query below when a cursor is provided.
// If we used "const", the line `query = query.lt(...)` would be a TypeScript error.
let query = supabase
  .from("products")
  .select("*")
  .eq("is_active", "active")
  .order("created_at", { ascending: false })
  .limit(limit + 1);

if (cursor) {
  query = query.lt("created_at", cursor); // ← reassignment; requires "let"
}
```

---

### Zustand store (`create<State>()(...)`)
**What it is:** A state container for the React app. Zustand stores hold values (state) and functions that update them (actions). Any component that calls `useProductsStore()` gets the current state and re-renders automatically when it changes.

**Why it exists:** React components don't naturally share state between each other. Without a store, you'd have to pass `products` as a prop through every component in the tree ("prop drilling"). The store is a single source of truth any component can read directly.

**In this step:** The store gains two new state fields (`nextCursor`, `hasMore`, `isLoadingMore`) and a new action (`loadMoreProducts`). The existing `loadProducts` action is updated to reset these fields on every first-page fetch.

```typescript
// create<ProductsState>() — Zustand's factory function.
// The interface above is passed as a generic so TypeScript validates the shape.
export const useProductsStore = create<ProductsState>()(
  persist(            // ← middleware: persists `products` to localStorage
    (set, get) => ({  // ← set() updates state; get() reads current state
      products: [],
      nextCursor: null,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,

      loadMoreProducts: async () => { ... },
    })
  )
);
```

---

### JSX conditional block (`{condition && <Component />}`)
**What it is:** A React pattern for conditionally rendering UI. In JSX, `{expression}` evaluates JavaScript inside the template. The `&&` operator returns the right side only when the left side is truthy — so when it's falsy, nothing renders.

**Why it exists:** There's no `if` statement directly inside JSX markup. This is the idiomatic React substitute.

**In this step:**
```tsx
{/* When hasMore is false (last page loaded), this entire block disappears from the DOM.
    When hasMore is true, the button renders. */}
{hasMore && (
  <Button onClick={loadMoreProducts} disabled={isLoadingMore}>
    {isLoadingMore ? "Loading..." : "Load More"}
  </Button>
)}
```

---

## Coding Concepts Used

Before looking at the code changes, here's a quick reference for every programming concept that appears in the implementation. Come back to this table when you see something unfamiliar in the code below.

| Concept | What it is | Where it appears |
|---------|-----------|-----------------|
| **Default parameter** | `limit = 12` — the value used when the caller doesn't pass that argument | Function signature |
| **Optional parameter** | `cursor?: string` — the `?` means the caller can omit it entirely; TypeScript types it as `string \| undefined` | Function signature |
| **Generic return type** | `Promise<{ products: Product[]; nextCursor: string \| null; hasMore: boolean }>` — the caller knows exactly what shape comes back | Function return type |
| **Method chaining** | `.from().select().eq().order().limit()` — each Supabase method returns the same query builder object so you can keep calling methods on it | Supabase query |
| **Conditional query building** | Assigning the query to a `let` variable then conditionally calling `.lt()` on it — the query isn't sent until you `await` it | Adding the cursor filter |
| **Fetch N+1 trick** | Requesting `limit + 1` rows to detect if more exist, then slicing back to `limit` before returning — avoids a slow `COUNT(*)` query | `hasMore` detection |
| **Optional chaining (`?.`)** | `products.at(-1)?.created_at` — safely accesses `.created_at` only if the array is non-empty; returns `undefined` otherwise | Extracting `nextCursor` |
| **Nullish coalescing (`??`)** | `?? null` — if the left side is `null` or `undefined`, use the right side instead | Returning `nextCursor` |
| **Array spread for append** | `[...state.products, ...newProducts]` — creates a new array combining existing and new items without mutating the original | `loadMoreProducts` in store |
| **Zustand `set` with function** | `set((state) => ({ ... }))` — when new state depends on existing state, pass a function to `set` instead of an object | `loadMoreProducts` in store |
| **Discriminated state** | Separate `isLoading` (first page) and `isLoadingMore` (subsequent pages) booleans so the UI can show different indicators for each | Store state |

---

## How This Fits in the DigitalJems Codebase

### Current code (the problem)

**`src/components/lib/sdk.ts` — line 551:**
```typescript
async getAllProducts(limit = 100): Promise<Product[]> {
  // CONCEPT: default parameter — if no limit is passed, uses 100.
  // The problem: 100 is an arbitrary ceiling. There's no way to fetch
  // "the next 100" — you always get the same first 100.
  if (isDev) return DEV_PRODUCTS.slice(0, limit);

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", "active")
    .order("created_at", { ascending: false })
    .limit(limit); // ← no cursor filter; always starts from the beginning

  if (error) throw error;
  return (data || []).map(parseProductImages) as Product[];
}
```

**`src/components/store/products-store.ts` — line 40:**
```typescript
loadProducts: async () => {
  set({ isLoading: true, error: null });

  // Every call replaces the entire products list — there is no concept
  // of "appending the next page" to what we already have.
  const products = await productService.getAllProducts();
  set({ products, isLoading: false });
},
```

---

### What we'll add — annotated

#### 1. New method in `src/components/lib/sdk.ts`

```typescript
async getAllProductsPaginated(
  limit = 12,       // CONCEPT: default parameter — 12 products per page if not specified
  cursor?: string   // CONCEPT: optional parameter — undefined on the first call (no cursor yet)
                    //   The ? means TypeScript types this as string | undefined
): Promise<{ products: Product[]; nextCursor: string | null; hasMore: boolean }> {
  // CONCEPT: generic return type — the caller knows exactly what shape this returns.
  //   Wrapping in Promise<> because this is async (network call).

  // --- Dev mode path (no real Supabase) ---
  if (isDev) {
    // CONCEPT: ternary operator for conditional start index.
    //   If we have a cursor, find where that product is in the array and start after it.
    //   If no cursor, start at index 0 (first page).
    const start = cursor
      ? DEV_PRODUCTS.findIndex((p) => p.created_at === cursor) + 1
      : 0;

    const page = DEV_PRODUCTS.slice(start, start + limit);

    return {
      products: page,
      // CONCEPT: optional chaining (?.) + nullish coalescing (??)
      //   .at(-1) gets the last element of the array (negative index = from the end).
      //   ?.created_at safely accesses created_at only if the array is non-empty.
      //   ?? null returns null if the result is undefined (empty array case).
      nextCursor: page.at(-1)?.created_at ?? null,
      hasMore: start + limit < DEV_PRODUCTS.length,
    };
  }

  // --- Production path ---

  // CONCEPT: method chaining — each Supabase call returns the same query builder,
  //   so we can keep appending conditions. The query is NOT sent to the database
  //   until we await it below.
  // CONCEPT: let (not const) — we need to reassign `query` when adding the cursor filter.
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", "active")
    .order("created_at", { ascending: false })
    .limit(limit + 1); // CONCEPT: fetch N+1 trick — request one extra row.
                       //   If we get back 13 rows when we asked for 13 (limit=12+1),
                       //   it means there are more pages. We'll slice it back to 12 before returning.
                       //   This avoids a separate COUNT(*) query which is slow on large tables.

  if (cursor) {
    // CONCEPT: conditional query building — only add the cursor filter when we have one.
    //   .lt("created_at", cursor) translates to: WHERE created_at < cursor
    //   "Less than" on timestamps = "older than", which gives us the next page.
    //   This is the core of cursor-based pagination: the WHERE clause replaces OFFSET.
    query = query.lt("created_at", cursor);
  }

  // CONCEPT: destructuring — pull `data` and `error` out of the response object in one line.
  const { data, error } = await query;
  if (error) throw error;

  // CONCEPT: the N+1 detection.
  //   If data has MORE than `limit` rows, there's a next page.
  //   (data || []) guards against data being null.
  const hasMore = (data || []).length > limit;

  // CONCEPT: .slice(0, limit) — discard the extra row we fetched for detection.
  //   We only return `limit` rows to the caller; the +1 was just a signal.
  const products = (data || [])
    .slice(0, limit)
    .map(parseProductImages) as Product[];

  return {
    products,
    // CONCEPT: optional chaining + nullish coalescing again.
    //   The last product's created_at becomes the cursor for the next call.
    //   If the page was empty (shouldn't happen but safe to handle), returns null.
    nextCursor: products.at(-1)?.created_at ?? null,
    hasMore,
  };
},
```

---

#### 2. Updated state in `src/components/store/products-store.ts`

```typescript
interface ProductsState {
  products: Product[];
  nextCursor: string | null; // null = no more pages / haven't loaded yet
  hasMore: boolean;          // controls whether the "Load More" button is shown
  isLoading: boolean;        // true only on the FIRST load (shows skeleton UI)
  isLoadingMore: boolean;    // true only on subsequent loads (shows spinner on button)
  // CONCEPT: discriminated state — two separate loading flags so the UI can react
  //   differently. If isLoading=true, show the full skeleton. If isLoadingMore=true,
  //   just disable the button. Combining them into one flag would lose that distinction.
  ...
  loadProducts: () => Promise<void>;
  loadMoreProducts: () => Promise<void>; // new: appends next page to existing list
}

// Inside the store:
loadProducts: async () => {
  // Resets everything — used on first mount and after category changes
  set({ isLoading: true, nextCursor: null, products: [] });
  const result = await productService.getAllProductsPaginated(12);
  set({
    products: result.products,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    isLoading: false,
  });
},

loadMoreProducts: async () => {
  const { nextCursor, isLoadingMore } = get();
  if (isLoadingMore || !nextCursor) return; // guard: don't double-fetch

  set({ isLoadingMore: true });
  const result = await productService.getAllProductsPaginated(12, nextCursor);

  // CONCEPT: set with a function — when new state depends on existing state,
  //   pass a function to set() instead of an object. Zustand calls it with the
  //   current state, so you're always working with the latest snapshot.
  set((state) => ({
    // CONCEPT: array spread for immutable append — create a NEW array combining
    //   existing products and new ones. Never mutate state.products directly.
    //   React/Zustand detect changes by reference equality — a new array triggers a re-render,
    //   mutating the existing one does not.
    products: [...state.products, ...result.products],
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    isLoadingMore: false,
  }));
},
```

---

#### 3. "Load More" button in `src/components/pages/HomePage.tsx`

```tsx
const { filteredProducts, hasMore, isLoadingMore, loadMoreProducts } = useProductsStore();

// ... product grid renders here ...

{/* CONCEPT: short-circuit rendering — the && operator only renders the right side
    if the left side is truthy. When hasMore=false, nothing is rendered at all.
    This is React's idiomatic way to conditionally show UI. */}
{hasMore && (
  <div className="flex justify-center mt-8">
    <button
      onClick={loadMoreProducts}
      disabled={isLoadingMore} // CONCEPT: disable during fetch to prevent double-clicks
      className="..."
    >
      {/* CONCEPT: ternary in JSX — show different text based on loading state */}
      {isLoadingMore ? "Loading..." : "Load More"}
    </button>
  </div>
)}
```

---


## What You'll Learn Building This

| Concept | Why It Matters |
|---------|---------------|
| O(log N) vs O(N) query cost | Every extra offset you add makes future queries slower. Cursor queries don't. |
| Indexed column as a cursor | Any unique, sortable, indexed column can be a cursor — not just `created_at`. UUIDs ordered by insertion also work. |
| "Fetch N+1 to detect hasMore" | A clean pattern to know if there's a next page without a COUNT(*) query. |
| Append-on-load vs. replace-on-load | `loadProducts()` replaces state. `loadMoreProducts()` appends to it. |
| Immutable state updates | Always spread into a new array instead of pushing into the existing one. |

---

## Interview Version (One Paragraph)

> "Offset pagination tells the database to skip N rows, which forces a sequential scan even with an index — so page 500 is 500x slower than page 1. Cursor-based pagination instead remembers the last row you saw (via a unique, sortable column like `created_at` or a UUID) and uses a `WHERE created_at < cursor` clause. Since the column is indexed, the database jumps directly to that position in O(log N) time, regardless of how deep into the dataset you are. It also prevents the duplicate/skip problem that happens with offset when rows are inserted or deleted between page fetches."

---

## Files to Touch

| File | Change |
|------|--------|
| `src/components/lib/sdk.ts` | Add `getAllProductsPaginated(limit, cursor?)` to `productService` |
| `src/components/store/products-store.ts` | Add `nextCursor`, `hasMore`, `isLoadingMore`, `loadMoreProducts()` |
| `src/components/pages/HomePage.tsx` | Add "Load More" button, wire `loadMoreProducts` |
