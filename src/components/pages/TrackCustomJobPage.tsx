import { useEffect, useState } from "react";
// CONCEPT: useParams — React Router extracts URL segments as a typed object
import { useParams } from "react-router-dom";
import { Loader2, Package, Calendar, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CustomerMilestoneTimeline } from "@/components/CustomerMilestoneTimeline";
import { customJobService } from "@/components/lib/sdk";
import type { CustomJobPublic, CustomJobStatus } from "@/components/types";

const STATUS_CONFIG: Record<CustomJobStatus, { label: string; color: string }> = {
  intake:               { label: "Intake",             color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  design:               { label: "In Design",          color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  quoted:               { label: "Quote Sent",         color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  approved:             { label: "Approved",           color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  deposit_pending:      { label: "Deposit Pending",    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  in_production:        { label: "In Production",      color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  qc:                   { label: "Quality Check",      color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  ready_for_dispatch:   { label: "Ready to Ship",      color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  dispatched:           { label: "Dispatched",         color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  delivered:            { label: "Delivered",          color: "bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-200" },
  cancelled:            { label: "Cancelled",          color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  on_hold:              { label: "On Hold",            color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
};

const formatDate = (dateString?: string) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN")}`;

export function TrackCustomJobPage() {
  // CONCEPT: useParams — no auth required; token is extracted from the URL
  const { token } = useParams<{ token: string }>();
  const [job, setJob] = useState<CustomJobPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid tracking link.");
      setIsLoading(false);
      return;
    }

    customJobService
      .getByToken(token)
      .then(setJob)
      .catch(() => setError("This tracking link is invalid or has expired."))
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-semibold">Tracking Link Not Found</p>
            <p className="text-muted-foreground text-sm">
              {error ?? "This link may be invalid or the job may have been removed."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.intake;
  const completedCount = job.milestones.filter((m) => m.status === "done").length;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            DJewel Boutique
          </p>
          <h1 className="text-2xl font-bold">Order Tracker</h1>
        </div>

        {/* Job summary card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{job.job_number}</p>
                <CardTitle className="text-lg">{job.title}</CardTitle>
              </div>
              <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Production progress</span>
                <span>{completedCount} / {job.milestones.length} steps</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${(completedCount / Math.max(job.milestones.length, 1)) * 100}%` }}
                />
              </div>
            </div>

            <Separator />

            {/* Estimated date */}
            {job.estimated_ready_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Estimated ready date</p>
                  <p className="font-medium">{formatDate(job.estimated_ready_date)}</p>
                </div>
              </div>
            )}

            {/* Payment summary — amounts shown, IDs hidden */}
            {(job.deposit_amount > 0 || job.final_amount > 0) && (
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex gap-6">
                  {job.deposit_amount > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Deposit</p>
                      <p className="font-medium">{formatCurrency(job.deposit_amount)}</p>
                    </div>
                  )}
                  {job.final_amount > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Balance due</p>
                      <p className="font-medium">{formatCurrency(job.final_amount)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Milestone timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerMilestoneTimeline milestones={job.milestones} />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Questions? Contact us at support@djewelboutique.com
        </p>
      </div>
    </div>
  );
}
