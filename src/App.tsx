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
import NotFoundPage from "@/components/pages/NotFoundPage";
import { ScrollToTop } from "@/components/ScrollToTop";
import { supabase } from "@/components/lib/supabase";
import { useAuthStore } from "@/components/store/auth-store";
import { authService } from "@/components/lib/sdk";

function App() {
  // Initialize auth listener
  useEffect(() => {
    // Helper to sync session state
    const syncSession = async (session: { user: { id: string; email?: string | null } } | null) => {
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

        await useAuthStore.getState().loadProfile();
        await useAuthStore.getState().checkAdminStatus();
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event);
      
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await syncSession(session);
      } else if (event === "SIGNED_OUT") {
        await syncSession(null);
      }
    });

    // Check for existing session on app load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await syncSession(session);
    });

    // Refresh data when returning to tab (without full page reload)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        // Refresh the session token
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.refreshSession();
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
