import { Clock, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export interface MTODialogInfo {
  productName: string;
  leadTimeWeeks: number;
  depositAmount: number;
  finalAmount: number;
  totalAmount: number;
  depositPct: number;
}

interface MTOConfirmDialogProps {
  open: boolean;
  info: MTODialogInfo | null;
  onAccept: () => void;
  onCancel: () => void;
}

export function MTOConfirmDialog({ open, info, onAccept, onCancel }: MTOConfirmDialogProps) {
  if (!info) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Made-to-Order Available</DialogTitle>
          <DialogDescription>
            <strong>{info.productName}</strong> is currently out of stock but can be crafted to order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-amber-800 dark:text-amber-300">
              Estimated lead time: <strong>{info.leadTimeWeeks} weeks</strong>
            </span>
          </div>

          <Separator />

          {/* CONCEPT: split payment ledger — shown upfront so customer knows exactly what they owe now vs. later */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total order value</span>
              <span className="font-medium">₹{info.totalAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-green-700 dark:text-green-400">
              <span>Due now ({info.depositPct}% deposit)</span>
              <span className="font-semibold">₹{info.depositAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Due on completion</span>
              <span>₹{info.finalAmount.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground">
            You'll receive updates at each production milestone. The final payment link will be sent when your item is ready.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={onAccept} className="w-full sm:w-auto">
            <IndianRupee className="h-4 w-4 mr-1.5" />
            Pay Deposit ₹{info.depositAmount.toLocaleString("en-IN")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
