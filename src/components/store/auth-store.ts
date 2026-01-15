/**
 * Authentication Store
 * Manages user authentication state and profile
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authService, userProfileService } from "@/components/lib/sdk";
import type { UserProfile } from "@/components/types";

const isDev = import.meta.env.DEV;

interface AuthState {
  // State
  isAuthenticated: boolean;
  user: {
    uid: string;
    email: string;
    name: string;
  } | null;
  profile: UserProfile | null;
  isAdmin: boolean;

  // Actions
  login: (email: string, code: string) => Promise<{ isAdmin: boolean }>;
  logout: () => Promise<void>;
  sendOTP: (email: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  updateProfile: (name: string, phone: string) => Promise<void>;
  checkAdminStatus: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      profile: null,
      isAdmin: false,

      // Send OTP
      sendOTP: async (email: string) => {
        await authService.sendOTP(email);
      },

      // Login
      login: async (email: string, code: string) => {
        const response = await authService.verifyOTP(email, code);

        if (!response.user) {
          throw new Error("Login failed");
        }

        // Store user info (Supabase returns id, not uid)
        authService.storeUserInfo(
          response.user.id,
          response.user.email || email,
          ""
        );

        set({
          isAuthenticated: true,
          user: {
            uid: response.user.id,
            email: response.user.email || email,
            name: "",
          },
        });

        // Load profile and check admin status
        await get().loadProfile();
        await get().checkAdminStatus();
        
        return { isAdmin: get().isAdmin };
      },

      // Logout
      logout: async () => {
        try {
          await authService.logout();
        } catch (e) {
          console.error("Logout error:", e);
        }
        authService.clearUserInfo();
        localStorage.removeItem("auth-storage");

        set({
          isAuthenticated: false,
          user: null,
          profile: null,
          isAdmin: false,
        });
      },

      // Load user profile (creates one if it doesn't exist)
      loadProfile: async () => {
        const user = get().user;
        if (!user) return;

        try {
          let profile = await userProfileService.getProfile(user.email);
          
          // Create profile if it doesn't exist
          if (!profile) {
            profile = await userProfileService.upsertProfile(
              user.email, 
              "New User", 
              ""
            );
          }
          
          set({ profile });
        } catch (error) {
          console.error("Failed to load profile:", error);
        }
      },

      // Update profile
      updateProfile: async (name: string, phone: string) => {
        const user = get().user;
        if (!user) throw new Error("Not authenticated");

        // Import supabase here to avoid circular dependency
        const { supabase } = await import("@/components/lib/supabase");
        
        // Ensure we have a valid session before updating
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Session expired. Please log in again.");
        }

        const profile = await userProfileService.upsertProfile(
          user.email,
          name,
          phone
        );
        set({ profile });
      },

      // Check admin status
      checkAdminStatus: async () => {
        const user = get().user;
        if (!user) return;

        // Dev mode: check if dev admin user
        if (isDev) {
          const devUserInfo = authService.getDevUserInfo(user.email);
          if (devUserInfo?.isAdmin) {
            set({ isAdmin: true });
            return;
          }
        }

        try {
          const isAdmin = await userProfileService.isAdmin(user.email);
          set({ isAdmin });
        } catch (error) {
          console.error("Failed to check admin status:", error);
          set({ isAdmin: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        profile: state.profile,
        isAdmin: state.isAdmin,
      }),
    }
  )
);
