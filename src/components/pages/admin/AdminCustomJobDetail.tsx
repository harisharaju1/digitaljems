import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, UserCog, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/hooks/use-toast";
import { customJobService, adminLogService } from "@/components/lib/sdk";
import { MilestoneTimeline } from "@/components/admin/MilestoneTimeline";
import { JobVendorAssignDialog } from "@/components/admin/JobVendorAssignDialog";
import type { CustomJobDetail, CustomJobStatus, Vendor } from "@/components/types";

const STATUS_OPTIONS: CustomJobStatus[] = [
  "intake", "design", "quoted", "approved", "deposit_pending",
  "in_production", "qc", "ready_for_dispatch", "dispatched", "delivered", "on_hold", "cancelled",
];

export function AdminCustomJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<CustomJobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CustomJobStatus>("intake");

  useEffect(() => {
    if (id) load(id);
  }, [id]);

  async function load(jobId: string) {
    try {
      const data = await customJobService.get(jobId);
      setJob(data);
      setSelectedStatus(data.status);
    } catch {
      toast({ title: "Job not found", variant: "destructive" });
      navigate("/admin/custom-jobs");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(newStatus: CustomJobStatus) {
    if (!job || newStatus === job.status) return;
    const prevStatus = job.status;
    setJob(prev => prev ? { ...prev, status: newStatus } : prev);
    setSelectedStatus(newStatus);
    setIsUpdating(true);
    try {
      await customJobService.update(job.id, { status: newStatus });
      await adminLogService.logAction("job_status_changed", "job", job.id, { from: prevStatus, to: newStatus });
      toast({ title: `Status updated to ${newStatus.replace(/_/g, " ")}` });
    } catch {
      setJob(prev => prev ? { ...prev, status: prevStatus } : prev);
      setSelectedStatus(prevStatus);
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleVendorAssign(vendor: Vendor) {
    if (!job) return;
    try {
      await customJobService.assignVendor(job.id, vendor.id);
      await adminLogService.logAction("job_status_changed", "job", job.id, { action: "vendor_assigned", vendor_id: vendor.id, vendor_name: vendor.name });
      setJob(prev => prev ? { ...prev, vendor_id: vendor.id, vendor } : prev);
      toast({ title: `Assigned to ${vendor.name}` });
    } catch {
      toast({ title: "Failed to assign vendor", variant: "destructive" });
    }
  }

  async function handlePaymentToggle(field: "deposit_paid" | "final_paid", value: boolean) {
    if (!job) return;
    setJob(prev => prev ? { ...prev, [field]: value } : prev);
    try {
      await customJobService.update(job.id, { [field]: value });
      toast({ title: `${field === "deposit_paid" ? "Deposit" : "Final payment"} marked ${value ? "paid" : "unpaid"}` });
    } catch {
      setJob(prev => prev ? { ...prev, [field]: !value } : prev);
      toast({ title: "Failed to update payment status", variant: "destructive" });
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!job) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/custom-jobs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono">{job.job_number}</h1>
            <Badge variant="secondary" className="capitalize">{job.source.replace("_", " ")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{job.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Select value={selectedStatus} onValueChange={v => handleStatusChange(v as CustomJobStatus)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: customer + vendor + financials */}
        <div className="space-y-4">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {job.customer_name && <p className="font-medium">{job.customer_name}</p>}
              <p className="text-muted-foreground">{job.customer_email}</p>
              {job.customer_phone && <p className="text-muted-foreground">{job.customer_phone}</p>}
            </CardContent>
          </Card>

          {/* Vendor */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Vendor (Karigar)</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setVendorDialogOpen(true)}>
                  <UserCog className="mr-1 h-3.5 w-3.5" />
                  {job.vendor ? "Change" : "Assign"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              {job.vendor ? (
                <div className="space-y-1">
                  <p className="font-medium">{job.vendor.name}</p>
                  {job.vendor.phone && <p className="text-muted-foreground">{job.vendor.phone}</p>}
                  <div className="flex gap-1 flex-wrap">
                    {job.vendor.specialties.map(s => (
                      <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace("_", " ")}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Not assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Financials */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Payments</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Deposit</p>
                  <p className="text-muted-foreground">₹{job.deposit_amount.toLocaleString("en-IN")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="deposit-switch" className="text-xs">Paid</Label>
                  <Switch id="deposit-switch" checked={job.deposit_paid} onCheckedChange={v => handlePaymentToggle("deposit_paid", v)} />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Final</p>
                  <p className="text-muted-foreground">₹{job.final_amount.toLocaleString("en-IN")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="final-switch" className="text-xs">Paid</Label>
                  <Switch id="final-switch" checked={job.final_paid} onCheckedChange={v => handlePaymentToggle("final_paid", v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          {(job.estimated_ready_date || job.actual_ready_date) && (
            <Card>
              <CardContent className="pt-4 text-sm space-y-1">
                {job.estimated_ready_date && (
                  <div><span className="text-muted-foreground">Est. ready: </span>{new Date(job.estimated_ready_date).toLocaleDateString("en-IN")}</div>
                )}
                {job.actual_ready_date && (
                  <div><span className="text-muted-foreground">Actual ready: </span>{new Date(job.actual_ready_date).toLocaleDateString("en-IN")}</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right columns: spec + milestones */}
        <div className="lg:col-span-2 space-y-4">
          {/* Specification */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Specification</CardTitle></CardHeader>
            <CardContent>
              <pre className="rounded bg-muted p-3 text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                {JSON.stringify(job.specification, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Milestone timeline */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Production Milestones</CardTitle></CardHeader>
            <CardContent>
              <MilestoneTimeline jobId={job.id} milestones={job.milestones} editable />
            </CardContent>
          </Card>
        </div>
      </div>

      <JobVendorAssignDialog
        open={vendorDialogOpen}
        currentVendorId={job.vendor_id}
        onAssign={handleVendorAssign}
        onClose={() => setVendorDialogOpen(false)}
      />
    </div>
  );
}
