/**
 * Admin Orders Management
 */

import { useState, useEffect } from "react";
import {
  Loader2,
  Search,
  MoreHorizontal,
  Eye,
  Truck,
  MessageCircle,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

const statusColors: Record<string, string> = {
  placed: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  processing: "bg-yellow-100 text-yellow-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  pending: "bg-gray-100 text-gray-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-orange-100 text-orange-800",
};

export function AdminOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateData, setUpdateData] = useState({
    order_status: "" as OrderStatus,
    payment_status: "" as PaymentStatus,
    tracking_number: "",
    shipping_provider: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await orderService.getAllOrders();
      setOrders(data);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || order.order_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const openDetailsDialog = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const openUpdateDialog = (order: Order) => {
    setSelectedOrder(order);
    setUpdateData({
      order_status: order.order_status,
      payment_status: order.payment_status,
      tracking_number: order.tracking_number || "",
      shipping_provider: order.shipping_provider || "",
      notes: order.notes || "",
    });
    setIsUpdateOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedOrder) return;

    setIsSaving(true);

    try {
      await orderService.updateOrderStatus(selectedOrder.id, {
        order_status: updateData.order_status,
        payment_status: updateData.payment_status,
        tracking_number: updateData.tracking_number || undefined,
        shipping_provider: updateData.shipping_provider || undefined,
        notes: updateData.notes || undefined,
      });

      await adminLogService.logAction("order_updated", "order", selectedOrder.id, {
        order_number: selectedOrder.order_number,
        new_status: updateData.order_status,
      });

      toast({ title: "Order updated successfully" });
      setIsUpdateOpen(false);
      loadOrders();
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

  const openWhatsApp = (phone: string, orderNumber: string) => {
    const message = encodeURIComponent(
      `Hi! Regarding your order ${orderNumber} from Luxury Jewels...`
    );
    const cleanPhone = phone.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">Orders</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {orderStatuses.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{filteredOrders.length} orders</p>

      {/* Mobile: Order Cards */}
      <div className="space-y-3 md:hidden">
        {filteredOrders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{order.order_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{order.customer_name}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDetailsDialog(order)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openUpdateDialog(order)}>
                      <Truck className="mr-2 h-4 w-4" />
                      Update Status
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openWhatsApp(order.customer_phone, order.order_number)}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => window.open(`tel:${order.customer_phone}`)}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">{formatCurrency(order.total_amount)}</span>
                <Badge className={`${statusColors[order.order_status]} text-xs`}>
                  {order.order_status}
                </Badge>
                <Badge className={`${statusColors[order.payment_status]} text-xs`}>
                  {order.payment_status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {order.items.length} item(s) • {formatDate(order.created_at)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Orders Table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.items.length} item(s)
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.customer_email}
                    </p>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(order.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.order_status]}>
                      {order.order_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.payment_status]}>
                      {order.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetailsDialog(order)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openUpdateDialog(order)}>
                          <Truck className="mr-2 h-4 w-4" />
                          Update Status
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openWhatsApp(order.customer_phone, order.order_number)}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          WhatsApp Customer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => window.open(`tel:${order.customer_phone}`)}
                        >
                          <Phone className="mr-2 h-4 w-4" />
                          Call Customer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order {selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>
              Placed on {selectedOrder && formatDate(selectedOrder.created_at)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="mb-2 font-semibold">Customer Information</h3>
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p><strong>Name:</strong> {selectedOrder.customer_name}</p>
                  <p><strong>Email:</strong> {selectedOrder.customer_email}</p>
                  <p><strong>Phone:</strong> {selectedOrder.customer_phone}</p>
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <h3 className="mb-2 font-semibold">Shipping Address</h3>
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p>{selectedOrder.shipping_address.line1}</p>
                  {selectedOrder.shipping_address.line2 && (
                    <p>{selectedOrder.shipping_address.line2}</p>
                  )}
                  <p>
                    {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state}
                  </p>
                  <p>
                    {selectedOrder.shipping_address.pincode}, {selectedOrder.shipping_address.country}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="mb-2 font-semibold">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 rounded-lg border p-3">
                      <div className="h-12 w-12 overflow-hidden rounded bg-muted">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Order Summary */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatCurrency(selectedOrder.shipping_cost)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Savings</span>
                  <span>-{formatCurrency(selectedOrder.total_savings)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              </div>

              {/* Tracking Info */}
              {selectedOrder.tracking_number && (
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="font-medium">Tracking Information</p>
                  <p className="text-sm">
                    {selectedOrder.tracking_number}
                    {selectedOrder.shipping_provider && ` via ${selectedOrder.shipping_provider}`}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsDetailsOpen(false);
              if (selectedOrder) openUpdateDialog(selectedOrder);
            }}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Order {selectedOrder?.order_number}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
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

            <div className="grid gap-2">
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

            <div className="grid gap-2">
              <Label>Tracking Number</Label>
              <Input
                value={updateData.tracking_number}
                onChange={(e) => setUpdateData({ ...updateData, tracking_number: e.target.value })}
                placeholder="Enter tracking number"
              />
            </div>

            <div className="grid gap-2">
              <Label>Shipping Provider</Label>
              <Input
                value={updateData.shipping_provider}
                onChange={(e) => setUpdateData({ ...updateData, shipping_provider: e.target.value })}
                placeholder="e.g., BlueDart, DTDC, India Post"
              />
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={updateData.notes}
                onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                placeholder="Internal notes about this order"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
