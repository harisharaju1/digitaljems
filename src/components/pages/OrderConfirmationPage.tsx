/**
 * Order Confirmation Page
 * Shows order success with savings highlight
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Package,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { orderService } from "@/components/lib/sdk";
import type { Order } from "@/components/types";

export function OrderConfirmationPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber) {
      navigate("/");
      return;
    }

    loadOrder();
  }, [orderNumber]);

  const loadOrder = async () => {
    try {
      const orderData = await orderService.getOrderByNumber(orderNumber!);
      if (!orderData) {
        navigate("/");
        return;
      }
      setOrder(orderData);
    } catch (error) {
      console.error("Failed to load order:", error);
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          {/* Success Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="mb-2 text-3xl font-bold">
              Order Placed Successfully!
            </h1>
            <p className="text-lg text-muted-foreground">
              Thank you for your order, {order.customer_name}
            </p>
          </div>

          {/* Order Number */}
          <Card className="mb-6 border-accent/50 bg-accent/5">
            <CardContent className="p-6 text-center">
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Order Number
              </p>
              <p className="text-2xl font-bold">{order.order_number}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                A confirmation email has been sent to{" "}
                <span className="font-medium">{order.customer_email}</span>
              </p>
            </CardContent>
          </Card>

          {/* Savings Highlight */}
          {order.total_savings > 0 && (
            <Card className="mb-6 overflow-hidden border-accent">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-accent/20">
                    <Sparkles className="h-8 w-8 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-accent">
                      ₹{order.total_savings.toLocaleString("en-IN")} Saved!
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      You saved this amount on making charges by shopping online
                      instead of visiting a showroom
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Details */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="mb-4 text-xl font-bold">Order Details</h2>

              {/* Items */}
              <div className="mb-4 space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-16 w-16 rounded object-cover bg-muted"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold">
                      ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              {/* Summary */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{order.subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>₹{order.shipping_cost.toLocaleString("en-IN")}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>₹{order.total_amount.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="mb-3 text-xl font-bold">Shipping Address</h2>
              <div className="text-sm">
                <p>{order.customer_name}</p>
                <p className="mt-2">
                  {order.shipping_address.line1}
                  {order.shipping_address.line2 &&
                    `, ${order.shipping_address.line2}`}
                </p>
                <p>
                  {order.shipping_address.city}, {order.shipping_address.state}
                </p>
                <p>{order.shipping_address.pincode}</p>
                <p className="mt-2 text-muted-foreground">
                  {order.customer_phone}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Package className="h-8 w-8 text-accent" />
                <div>
                  <h3 className="font-bold">Order Status</h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {order.order_status.replace("_", " ")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We'll send you updates via email and WhatsApp
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="btn-premium flex-1"
              size="lg"
              onClick={() => navigate("/")}
            >
              Continue Shopping
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => navigate("/orders")}
            >
              View All Orders
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
