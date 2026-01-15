/**
 * Shopping Cart Store
 * Manages cart items with persistence
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product, CartItem } from "@/components/types";

interface CartState {
  // State
  items: CartItem[];

  // Computed
  itemCount: number;
  subtotal: number;
  totalSavings: number;

  // Actions
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItem: (productId: string) => CartItem | undefined;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],

      // Computed getters
      get itemCount() {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      get subtotal() {
        return get().items.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0
        );
      },

      get totalSavings() {
        return get().items.reduce(
          (total, item) =>
            total + item.product.making_charges_saved * item.quantity,
          0
        );
      },

      // Add item to cart
      addItem: (product: Product, quantity = 1) => {
        const items = get().items;
        const existingItem = items.find(
          (item) => item.product.id === product.id
        );

        if (existingItem) {
          // Update quantity
          set({
            items: items.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          });
        } else {
          // Add new item
          set({ items: [...items, { product, quantity }] });
        }
      },

      // Remove item from cart
      removeItem: (productId: string) => {
        set({
          items: get().items.filter((item) => item.product.id !== productId),
        });
      },

      // Update item quantity
      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        set({
          items: get().items.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          ),
        });
      },

      // Clear entire cart
      clearCart: () => {
        set({ items: [] });
      },

      // Get specific item
      getItem: (productId: string) => {
        return get().items.find((item) => item.product.id === productId);
      },
    }),
    {
      name: "cart-storage",
    }
  )
);
