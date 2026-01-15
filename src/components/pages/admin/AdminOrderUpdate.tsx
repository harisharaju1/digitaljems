/**
 * Admin Order Update Page
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/hooks/use-toast";
import { orderService, adminLogService } from "@/components/lib/sdk";
import type { Order, OrderStatus, PaymentStatus } from "@/components/types";

const orderStatuses: OrderStatus[] = [
  "placed", "confirmed", "processing", "shipped", "delivered", "cancelled"
];

const paymentStatuses: PaymentStatus[] = [
  "pending", "completed", "failed", "refunded"
];

export function AdminOrderUpdate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updateData, setUpdateData] = useState({
    order_status: "" as OrderStatus,
    payment_status: "" as PaymentStatus,
    tracking_number: "",
    shipping_provider: "",
    notes: "",
  });

  useEffect(() => {
    if (id) loadOrder(id);
  }, [id]);

  const loadOrder = async (orderId: string) => {
    try {
      const orders = await orderService.getAllOrders();
      const found = orders.find((o) => o.id === orderId);
      if (found) {
        setOrder(found);
        setUpdateData({
          order_status: found.order_status,
          payment_status: found.payment_status,
          tracking_number: found.tracking_number || "",
          shipping_provider: found.shipping_provider || "",
          notes: found.notes || "",
        });
      }
    } catch (error) {
      console.error("Failed to load order:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!order) return;

    setIsSaving(true);

    try {
      await orderService.updateOrderStatus(order.id, {
        order_status: updateData.order_status,
        payment_status: updateData.payment_status,
        tracking_number: updateData.tracking_number || undefined,
        shipping_provider: updateData.shipping_provider || undefined,
        notes: updateData.notes || undefined,
      });

      await adminLogService.logAction("order_updated", "order", order.id, {
        order_number: order.order_number,
        new_status: updateData.order_status,
      });

      toast({ title: "Order updated successfully" });
      navigate(`/admin/orders/${order.id}`);
    } catch (error) {
      toast({
        title: "Failed to update order",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium mb-4">Order not found</p>
        <Button onClick={() => navigate("/admin/orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(`/admin/orders/${order.id}`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Order
        </Button>
        <h1 className="text-2xl font-bold">Update Order Status</h1>
        <p className="text-muted-foreground">Order {order.order_number}</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Order Status */}
          <div className="space-y-2">
            <Label>Order Status</Label>
            <Select
              value={updateData.order_status}
              onValueChange={(v) => setUpdateData({ ...updateData, order_status: v as OrderStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orderStatuses.map((status) => (
                  <SelectItem key={status} value={status} className="capitalize">
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Status */}
          <div className="space-y-2">
            <Label>Payment Status</Label>
            <Select
              value={updateData.payment_status}
              onValueChange={(v) => setUpdateData({ ...updateData, payment_status: v as PaymentStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentStatuses.map((status) => (
                  <SelectItem key={status} value={status} className="capitalize">
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tracking Number */}
          <div className="space-y-2">
            <Label>Tracking Number</Label>
            <Input
              value={updateData.tracking_number}
              onChange={(e) => setUpdateData({ ...updateData, tracking_number: e.target.value })}
              placeholder="Enter tracking number"
            />
          </div>

          {/* Shipping Provider */}
          <div className="space-y-2">
            <Label>Shipping Provider</Label>
            <Input
              value={updateData.shipping_provider}
              onChange={(e) => setUpdateData({ ...updateData, shipping_provider: e.target.value })}
              placeholder="e.g., BlueDart, DTDC, India Post"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={updateData.notes}
              onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
              placeholder="Internal notes about this order"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate(`/admin/orders/${order.id}`)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Order
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
