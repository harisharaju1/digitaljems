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
import { AdminLayout } from "@/components/pages/admin/AdminLayout";
import { AdminDashboard } from "@/components/pages/admin/AdminDashboard";
import { AdminProducts } from "@/components/pages/admin/AdminProducts";
import { AdminOrders } from "@/components/pages/admin/AdminOrders";
import NotFoundPage from "@/components/pages/NotFoundPage";
import { initAnalytics } from "@/components/lib/analytics";
import { initErrorTracking } from "@/components/lib/error-tracking";

function App() {
  // Initialize analytics and error tracking on app start
  useEffect(() => {
    initAnalytics();
    initErrorTracking();
  }, []);

  return (
    <HelmetProvider>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Admin Routes - No Header */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
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
