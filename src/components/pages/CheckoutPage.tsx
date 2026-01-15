/**
 * Checkout Page
 * Guest checkout with email, phone, address
 * Includes Razorpay payment integration
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/hooks/use-toast";
import { useCartStore } from "@/components/store/cart-store";
import { useAuthStore } from "@/components/store/auth-store";
import { orderService, emailNotificationService } from "@/components/lib/sdk";
import { checkoutFormSchema, validateForm, type CheckoutFormValues } from "@/components/lib/validation";
import { initiatePayment } from "@/components/lib/payments";
import { ecommerceEvents } from "@/components/lib/analytics";
import { captureException } from "@/components/lib/error-tracking";
import { PageSEO } from "@/components/SEO";
import type { CheckoutFormData, OrderItem } from "@/components/types";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { items, subtotal, totalSavings, clearCart } = useCartStore();
  const { user, profile } = useAuthStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CheckoutFormData>({
    customer_name: user?.name || profile?.name || "",
    customer_email: user?.email || profile?.email || "",
    customer_phone: profile?.phone || "",
    shipping_address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
  });

  const SHIPPING_COST = 200;
  const total = subtotal + SHIPPING_COST;

  useEffect(() => {
    if (items.length === 0) {
      navigate("/cart");
    }
  }, [items.length, navigate]);

  if (items.length === 0) {
    return null;
  }

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith("shipping_address.")) {
      const addressField = field.split(".")[1];
      setFormData({
        ...formData,
        shipping_address: {
          ...formData.shipping_address,
          [addressField]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [field]: value,
      });
    }
  };

  const validateCheckoutForm = (): CheckoutFormValues | null => {
    const result = validateForm(checkoutFormSchema, formData);
    
    if (!result.success) {
      setErrors(result.errors || {});
      toast({
        title: "Please fix the errors",
        description: "Some fields need your attention",
        variant: "destructive",
      });
      return null;
    }
    
    setErrors({});
    return result.data!;
  };

  const handlePlaceOrder = async () => {
    const validatedData = validateCheckoutForm();
    if (!validatedData) return;

    setIsSubmitting(true);

    try {
      // Track checkout analytics
      ecommerceEvents.beginCheckout(
        items.map((i) => ({ id: i.product.id, name: i.product.name, price: i.product.price, quantity: i.quantity })),
        total
      );

      // Convert cart items to order items
      const orderItems: OrderItem[] = items.map((item) => ({
        product_id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        image: item.product.images[0],
        weight_grams: item.product.weight_grams,
        making_charges_saved: item.product.making_charges_saved,
      }));

      // Create order first (with pending payment status)
      const order = await orderService.createOrder(formData, orderItems, {
        subtotal,
        totalSavings,
        shippingCost: SHIPPING_COST,
        totalAmount: total,
      });

      // Initiate payment
      const paymentResult = await initiatePayment({
        orderId: order.order_number,
        amount: total * 100, // Convert to paise
        customerName: formData.customer_name,
        customerEmail: formData.customer_email,
        customerPhone: formData.customer_phone,
        description: `Order #${order.order_number}`,
      });

      if (!paymentResult.success) {
        // Payment failed or cancelled - update order status
        await orderService.updateOrderStatus(order.id, "payment_failed");
        toast({
          title: "Payment cancelled",
          description: paymentResult.error || "Please try again",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Payment successful - update order with payment details
      await orderService.updateOrderPayment(order.id, {
        payment_status: "paid",
        payment_id: paymentResult.paymentId!,
        payment_method: "razorpay",
      });

      // Track purchase analytics
      ecommerceEvents.purchase(
        order.order_number,
        total,
        items.map((i) => ({ id: i.product.id, name: i.product.name, price: i.product.price, quantity: i.quantity }))
      );

      // Send confirmation email
      try {
        await emailNotificationService.sendOrderConfirmation(order);
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        captureException(emailError as Error, { orderId: order.id });
      }

      // Clear cart
      clearCart();

      // Show success message
      toast({
        title: "Payment successful!",
        description: `Order #${order.order_number} has been placed.`,
      });

      // Navigate to order confirmation
      navigate(`/order-confirmation/${order.order_number}`);
    } catch (error) {
      console.error("Checkout error:", error);
      captureException(error as Error, { formData });
      toast({
        title: "Order failed",
        description:
          error instanceof Error ? error.message : "Failed to place order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSEO.Checkout />
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">Checkout</h1>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  id="name"
                  label="Full Name"
                  required
                  value={formData.customer_name}
                  onChange={(e) => handleInputChange("customer_name", e.target.value)}
                  placeholder="Enter your full name"
                  error={errors.customer_name}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id="email"
                    label="Email Address"
                    type="email"
                    required
                    value={formData.customer_email}
                    onChange={(e) => handleInputChange("customer_email", e.target.value)}
                    placeholder="your@email.com"
                    error={errors.customer_email}
                  />
                  <FormField
                    id="phone"
                    label="Phone Number"
                    type="tel"
                    required
                    value={formData.customer_phone}
                    onChange={(e) => handleInputChange("customer_phone", e.target.value)}
                    placeholder="+91 9876543210"
                    error={errors.customer_phone}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  id="line1"
                  label="Address Line 1"
                  required
                  value={formData.shipping_address.line1}
                  onChange={(e) => handleInputChange("shipping_address.line1", e.target.value)}
                  placeholder="House/Flat number, Street name"
                  error={errors["shipping_address.line1"]}
                />
                <FormField
                  id="line2"
                  label="Address Line 2"
                  value={formData.shipping_address.line2}
                  onChange={(e) => handleInputChange("shipping_address.line2", e.target.value)}
                  placeholder="Landmark, Area (Optional)"
                  error={errors["shipping_address.line2"]}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    id="city"
                    label="City"
                    required
                    value={formData.shipping_address.city}
                    onChange={(e) => handleInputChange("shipping_address.city", e.target.value)}
                    placeholder="City"
                    error={errors["shipping_address.city"]}
                  />
                  <FormField
                    id="state"
                    label="State"
                    required
                    value={formData.shipping_address.state}
                    onChange={(e) => handleInputChange("shipping_address.state", e.target.value)}
                    placeholder="State"
                    error={errors["shipping_address.state"]}
                  />
                  <FormField
                    id="pincode"
                    label="Pincode"
                    required
                    value={formData.shipping_address.pincode}
                    onChange={(e) => handleInputChange("shipping_address.pincode", e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    error={errors["shipping_address.pincode"]}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Security Info */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">Secure Payment</p>
                    <p className="text-sm text-green-700 mt-1">
                      Your payment is processed securely via Razorpay. We never store your card details.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Order Items */}
                <div className="max-h-48 space-y-3 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex gap-3">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="h-12 w-12 rounded object-cover bg-muted"
                      />
                      <div className="flex-1 text-sm">
                        <p className="font-medium line-clamp-1">
                          {item.product.name}
                        </p>
                        <p className="text-muted-foreground">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">
                        ₹
                        {(item.product.price * item.quantity).toLocaleString(
                          "en-IN"
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      ₹{subtotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">
                      ₹{SHIPPING_COST.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold">
                      ₹{total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Savings */}
                {totalSavings > 0 && (
                  <div className="savings-badge w-full flex-col items-start p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      <span className="font-semibold">
                        You Save ₹{totalSavings.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs opacity-80">
                      On making charges vs. showroom prices
                    </p>
                  </div>
                )}

                {/* Pay Now Button */}
                <Button
                  className="btn-premium w-full"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Pay ₹{total.toLocaleString("en-IN")}
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  By placing your order, you agree to our terms and conditions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
