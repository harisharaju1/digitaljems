/**
 * Products Store
 * Manages product catalog and filtering
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { productService } from "@/components/lib/sdk";
import { cache } from "@/components/lib/cache";
import { config } from "@/components/lib/config";
import type { Product, ProductCategory } from "@/components/types";

const PRODUCTS_CACHE_KEY = "products:page1";

interface ProductsState {
  // State
  products: Product[];
  nextCursor: string | null; // created_at of the last loaded product; null = no more pages
  hasMore: boolean;          // whether more products exist beyond what's loaded
  isLoading: boolean;        // true during the first page load (shows skeleton UI)
  isLoadingMore: boolean;    // true during subsequent page loads (shows spinner on button)
  error: string | null;
  selectedCategory: ProductCategory | "all";
  searchQuery: string;

  // Actions
  loadProducts: () => Promise<void>;
  loadMoreProducts: () => Promise<void>;
  filterByCategory: (category: ProductCategory | "all") => void;
  setSearchQuery: (query: string) => void;
  getProductById: (id: string) => Product | undefined;

  // Computed
  filteredProducts: () => Product[];
}

export const useProductsStore = create<ProductsState>()(
  persist(
    (set, get) => ({
      // Initial state
      products: [],
      nextCursor: null,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      error: null,
      selectedCategory: "all",
      searchQuery: "",

      // Fetch the first page with SWR caching (Step 2 — system design learning)
      loadProducts: async () => {
        type PageResult = { products: Product[]; nextCursor: string | null; hasMore: boolean };
        const cached = cache.get<PageResult>(PRODUCTS_CACHE_KEY);

        if (cached) {
          if (!cache.isStale(PRODUCTS_CACHE_KEY, config.cache.productsListTtlMs)) {
            // CONCEPT: SWR FRESH path — data is < 60s old, serve from cache immediately.
            // No network call, no loading state — the user sees products at 0ms.
            set({ products: cached.products, nextCursor: cached.nextCursor, hasMore: cached.hasMore });
            return; // CONCEPT: early return — nothing else to do
          }

          // CONCEPT: SWR STALE path — data is > 60s old.
          // Serve stale data immediately so the user sees something right away.
          set({ products: cached.products, nextCursor: cached.nextCursor, hasMore: cached.hasMore });

          // CONCEPT: floating Promise — start the re-fetch without awaiting it.
          // The function returns to React immediately; the fetch finishes in the background.
          productService.getAllProductsPaginated(12).then((result) => {
            cache.set(PRODUCTS_CACHE_KEY, result);
            set({ products: result.products, nextCursor: result.nextCursor, hasMore: result.hasMore });
          }).catch(console.error); // always handle errors on floating Promises

          return; // CONCEPT: early return — user already has their products rendered
        }

        // CONCEPT: SWR MISSING path — no cache entry at all. Fetch normally with loading state.
        set({ isLoading: true, error: null, products: [], nextCursor: null, hasMore: true });

        try {
          const result = await productService.getAllProductsPaginated(12);
          cache.set(PRODUCTS_CACHE_KEY, result); // populate cache for future visits
          set({
            products: result.products,
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            isLoading: false,
          });
        } catch (error) {
          console.error("Failed to load products:", error);

          const errorMsg = error instanceof Error ? error.message : "Failed to load products";
          if (errorMsg.includes("JWT") || errorMsg.includes("token") || errorMsg.includes("auth")) {
            await new Promise(resolve => setTimeout(resolve, 500));
            try {
              const result = await productService.getAllProductsPaginated(12);
              cache.set(PRODUCTS_CACHE_KEY, result);
              set({
                products: result.products,
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
                isLoading: false,
              });
              return;
            } catch (retryError) {
              console.error("Retry failed:", retryError);
            }
          }

          set({ error: errorMsg, isLoading: false });
        }
      },

      // Fetch the next page and append to the existing list
      loadMoreProducts: async () => {
        const { nextCursor, isLoadingMore, hasMore } = get();

        // Guard: don't fetch if already loading or no more pages exist
        if (isLoadingMore || !hasMore || !nextCursor) return;

        set({ isLoadingMore: true });

        try {
          const result = await productService.getAllProductsPaginated(12, nextCursor);

          // Pass a function to set() so we read the latest state snapshot.
          // Spread into a new array — never mutate state.products directly.
          set((state) => ({
            products: [...state.products, ...result.products],
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            isLoadingMore: false,
          }));
        } catch (error) {
          console.error("Failed to load more products:", error);
          set({ isLoadingMore: false });
        }
      },

      // Filter by category (client-side; does not reset pagination)
      filterByCategory: (category) => {
        set({ selectedCategory: category });
      },

      // Set search query
      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      // Get product by ID
      getProductById: (id) => {
        return get().products.find((p) => p.id === id);
      },

      // Get filtered products (client-side filter over all loaded products)
      filteredProducts: () => {
        const { products, selectedCategory, searchQuery } = get();

        let filtered = products;

        if (selectedCategory !== "all") {
          filtered = filtered.filter((p) => p.category === selectedCategory);
        }

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (p) =>
              (p.name ?? "").toLowerCase().includes(query) ||
              (p.description ?? "").toLowerCase().includes(query) ||
              (p.category ?? "").toLowerCase().includes(query) ||
              (p.metal_type ?? "").toLowerCase().includes(query)
          );
        }

        return filtered;
      },
    }),
    {
      name: "products-storage",
      partialize: (state) => ({ products: state.products }),
    }
  )
);
