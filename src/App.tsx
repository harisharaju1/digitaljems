import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomePage } from "@/components/pages/HomePage";
import { CartPage } from "@/components/pages/CartPage";
import { CheckoutPage } from "@/components/pages/CheckoutPage";
import { OrderConfirmationPage } from "@/components/pages/OrderConfirmationPage";
import { LoginPage } from "@/components/pages/LoginPage";
import { ProfilePage } from "@/components/pages/ProfilePage";
import { OrderHistoryPage } from "@/components/pages/OrderHistoryPage";
import { CustomRequestPage } from "@/components/pages/CustomRequestPage";
import { ProductDetailPage } from "@/components/pages/ProductDetailPage";
import { AdminLayout } from "@/components/pages/admin/AdminLayout";
import { AdminDashboard } from "@/components/pages/admin/AdminDashboard";
import { AdminProducts } from "@/components/pages/admin/AdminProducts";
import { AdminProductForm } from "@/components/pages/admin/AdminProductForm";
import { AdminOrders } from "@/components/pages/admin/AdminOrders";
import { AdminOrderDetail } from "@/components/pages/admin/AdminOrderDetail";
import { AdminOrderUpdate } from "@/components/pages/admin/AdminOrderUpdate";
import { AdminCustomRequests } from "@/components/pages/admin/AdminCustomRequests";
import NotFoundPage from "@/components/pages/NotFoundPage";
import { ScrollToTop } from "@/components/ScrollToTop";
import { supabase } from "@/components/lib/supabase";
import { useAuthStore } from "@/components/store/auth-store";
import { authService } from "@/components/lib/sdk";

function App() {
  // Initialize auth listener
  useEffect(() => {
    // Helper to sync session state - wrapped in setTimeout to avoid blocking token refresh
    const syncSession = (session: { user: { id: string; email?: string | null } } | null) => {
      if (session?.user) {
        authService.storeUserInfo(
          session.user.id,
          session.user.email || "",
          ""
        );
        
        useAuthStore.setState({
          isAuthenticated: true,
          user: {
            uid: session.user.id,
            email: session.user.email || "",
            name: "",
          },
        });

        // Defer heavy async operations to not block auth state changes
        setTimeout(async () => {
          await useAuthStore.getState().loadProfile();
          await useAuthStore.getState().checkAdminStatus();
        }, 0);
      } else {
        // No session - clear auth state
        authService.clearUserInfo();
        useAuthStore.setState({
          isAuthenticated: false,
          user: null,
          profile: null,
          isAdmin: false,
        });
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event);
      
      // Handle all session-related events including INITIAL_SESSION (fires on tab focus)
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        syncSession(session);
      } else if (event === "SIGNED_OUT") {
        syncSession(null);
      }
    });

    // Check for existing session on app load
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session);
    });

    // Refresh session when returning to tab
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        try {
          // refreshSession returns the new session - use it to sync state
          const { data: { session }, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error("Session refresh error:", error);
            // If refresh fails, check if we still have a valid session
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
              syncSession(null); // Clear state if no valid session
            }
          }
          // Note: successful refresh triggers TOKEN_REFRESHED event, so syncSession will be called automatically
        } catch (e) {
          console.error("Visibility change session refresh failed:", e);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <HelmetProvider>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Routes>
          {/* Admin Routes - No Header */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id/edit" element={<AdminProductForm />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="orders/:id/update" element={<AdminOrderUpdate />} />
            <Route path="custom-requests" element={<AdminCustomRequests />} />
          </Route>

          {/* Customer Routes - With Header & Footer */}
          <Route
            path="*"
            element={
              <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/product/:id" element={<ProductDetailPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route
                      path="/order-confirmation/:orderNumber"
                      element={<OrderConfirmationPage />}
                    />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/orders" element={<OrderHistoryPage />} />
                    <Route path="/custom-request" element={<CustomRequestPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            }
          />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </TooltipProvider>
    </HelmetProvider>
  );
}

export default App;
