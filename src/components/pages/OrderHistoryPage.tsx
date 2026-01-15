/**
 * Order History Page for logged-in users
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Package, ChevronRight, Clock, CheckCircle, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/components/store/auth-store";
import { orderService } from "@/components/lib/sdk";
import type { Order } from "@/components/types";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  placed: { label: "Order Placed", icon: <Clock className="h-4 w-4" />, color: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Confirmed", icon: <CheckCircle className="h-4 w-4" />, color: "bg-green-100 text-green-800" },
  processing: { label: "Processing", icon: <Package className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-800" },
  shipped: { label: "Shipped", icon: <Truck className="h-4 w-4" />, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Delivered", icon: <CheckCircle className="h-4 w-4" />, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", icon: <XCircle className="h-4 w-4" />, color: "bg-red-100 text-red-800" },
};

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/orders" } } });
      return;
    }

    loadOrders();
  }, [isAuthenticated, navigate]);

  const loadOrders = async () => {
    if (!user?.email) return;

    try {
      const userOrders = await orderService.getOrdersByEmail(user.email);
      setOrders(userOrders);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Orders</h1>
        <Button variant="outline" onClick={() => navigate("/profile")}>
          Back to Profile
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">No orders yet</h2>
            <p className="mb-4 text-muted-foreground">
              Start shopping to see your orders here
            </p>
            <Button className="btn-premium" onClick={() => navigate("/")}>
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusConfig[order.order_status] || statusConfig.placed;
            
            return (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">
                        Order #{order.order_number}
                      </CardTitle>
                      <CardDescription>
                        Placed on {formatDate(order.created_at)}
                      </CardDescription>
                    </div>
                    <Badge className={status.color}>
                      {status.icon}
                      <span className="ml-1">{status.label}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {/* Order Items Preview */}
                  <div className="mb-4 space-y-2">
                    {order.items.slice(0, 2).map((item, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {item.quantity} × ₹{item.price.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    ))}
                    {order.items.length > 2 && (
                      <p className="text-sm text-muted-foreground">
                        +{order.items.length - 2} more item(s)
                      </p>
                    )}
                  </div>

                  {/* Order Total & Actions */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">
                        ₹{order.total_amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/order-confirmation/${order.order_number}`)}
                    >
                      View Details
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>

                  {/* Tracking Info */}
                  {order.tracking_number && (
                    <div className="mt-4 rounded-lg bg-muted p-3">
                      <p className="text-sm">
                        <span className="font-medium">Tracking:</span>{" "}
                        {order.tracking_number}
                        {order.shipping_provider && (
                          <span className="text-muted-foreground">
                            {" "}via {order.shipping_provider}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
