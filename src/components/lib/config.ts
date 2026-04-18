/**
 * Central app configuration — reads from environment variables with safe fallbacks.
 *
 * In Vite, env vars must be prefixed with VITE_ to be accessible in the browser bundle.
 * They are read from .env (local) or from the host's environment at build time (Vercel).
 *
 * To change a value without touching code:
 *   - Locally: edit .env and restart the dev server
 *   - Vercel:  Project Settings → Environment Variables → redeploy
 */

function envInt(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  const parsed = parseInt(raw, 10);
  // CONCEPT: isNaN guard — if the env var is missing or not a number, use the fallback
  return isNaN(parsed) ? fallback : parsed;
}

export const config = {
  cache: {
    // How long the first page of the product listing is considered fresh (milliseconds).
    // After this, loadProducts() will re-fetch in the background (SWR stale path).
    productsListTtlMs: envInt("VITE_PRODUCTS_LIST_CACHE_TTL_MS", 60_000),

    // How long an individual product detail is considered fresh (milliseconds).
    // Used by getProductById() to avoid re-fetching the same product repeatedly.
    productDetailTtlMs: envInt("VITE_PRODUCT_DETAIL_CACHE_TTL_MS", 300_000),
  },
};
