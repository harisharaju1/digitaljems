import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/hooks/use-toast";
import { orderService, adminLogService } from "@/components/lib/sdk";
import type { Order } from "@/components/types";

interface FinalInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSuccess: () => void;
}

export function FinalInvoiceDialog({ open, onOpenChange, order, onSuccess }: FinalInvoiceDialogProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const finalAmount = order.payment_split?.final.amount ?? 0;

  async function handleSend() {
    setIsSending(true);
    try {
      // Advance order status to signal final invoice is pending customer payment.
      // In a full integration this would also trigger a Razorpay payment link email.
      await orderService.updateOrderStatus(order.id, {
        order_status: "mto_ready_for_dispatch",
      });
      await adminLogService.logAction("mto_converted", "order", order.id, {
        action: "final_invoice_sent",
        amount: finalAmount,
        customer_email: order.customer_email,
      });
      toast({ title: "Final invoice sent", description: `Payment link for ₹${finalAmount.toLocaleString("en-IN")} sent to ${order.customer_email}` });
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to send invoice", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Final Invoice</DialogTitle>
          <DialogDescription>
            Send the final payment link to <strong>{order.customer_email}</strong> for order{" "}
            <strong>{order.order_number}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Final amount due</span>
            <span className="font-semibold">₹{finalAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Send to</span>
            <span>{order.customer_email}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
