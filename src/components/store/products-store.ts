/**
 * Products Store
 * Manages product catalog and filtering
 */

import { create } from "zustand";
import { productService } from "@/components/lib/sdk";
import type { Product, ProductCategory } from "@/components/types";

interface ProductsState {
  // State
  products: Product[];
  isLoading: boolean;
  error: string | null;
  selectedCategory: ProductCategory | "all";
  searchQuery: string;

  // Actions
  loadProducts: () => Promise<void>;
  filterByCategory: (category: ProductCategory | "all") => void;
  setSearchQuery: (query: string) => void;
  getProductById: (id: string) => Product | undefined;

  // Computed
  filteredProducts: () => Product[];
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  // Initial state
  products: [],
  isLoading: false,
  error: null,
  selectedCategory: "all",
  searchQuery: "",

  // Load all products
  loadProducts: async () => {
    set({ isLoading: true, error: null });

    try {
      const products = await productService.getAllProducts();
      set({ products, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to load products",
        isLoading: false,
      });
    }
  },

  // Filter by category
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

  // Get filtered products
  filteredProducts: () => {
    const { products, selectedCategory, searchQuery } = get();

    let filtered = products;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.metal_type.toLowerCase().includes(query)
      );
    }

    return filtered;
  },
}));
