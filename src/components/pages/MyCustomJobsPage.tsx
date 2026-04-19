import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/hooks/use-toast";
import { customJobService, customRequestService } from "@/components/lib/sdk";
import { useAuthStore } from "@/components/store/auth-store";
import type { CustomJob, CustomRequest, CustomJobStatus } from "@/components/types";

const JOB_STATUS_CONFIG: Record<CustomJobStatus, { label: string; color: string }> = {
  intake:             { label: "Intake",           color: "bg-gray-100 text-gray-800" },
  design:             { label: "In Design",        color: "bg-blue-100 text-blue-800" },
  quoted:             { label: "Quote Sent",       color: "bg-purple-100 text-purple-800" },
  approved:           { label: "Approved",         color: "bg-teal-100 text-teal-800" },
  deposit_pending:    { label: "Deposit Pending",  color: "bg-yellow-100 text-yellow-800" },
  in_production:      { label: "In Production",    color: "bg-amber-100 text-amber-800" },
  qc:                 { label: "Quality Check",    color: "bg-indigo-100 text-indigo-800" },
  ready_for_dispatch: { label: "Ready to Ship",    color: "bg-green-100 text-green-800" },
  dispatched:         { label: "Dispatched",       color: "bg-cyan-100 text-cyan-800" },
  delivered:          { label: "Delivered",        color: "bg-green-200 text-green-900" },
  cancelled:          { label: "Cancelled",        color: "bg-red-100 text-red-800" },
  on_hold:            { label: "On Hold",          color: "bg-orange-100 text-orange-800" },
};

const REQUEST_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending Review", color: "bg-yellow-100 text-yellow-800" },
  reviewed: { label: "Under Review",  color: "bg-blue-100 text-blue-800" },
  quoted:   { label: "Quote Sent",    color: "bg-green-100 text-green-800" },
  declined: { label: "Declined",      color: "bg-red-100 text-red-800" },
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// CONCEPT: discriminated union — kind field tells the renderer which branch to take
type UnifiedItem =
  | { kind: "job"; data: CustomJob; updatedAt: string }
  | { kind: "request"; data: CustomRequest; updatedAt: string };

export function MyCustomJobsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuthStore();
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/my-custom-jobs" } } });
      return;
    }
    loadItems();
  }, [isAuthenticated, navigate]);

  const loadItems = async () => {
    if (!user?.email) return;

    try {
      // CONCEPT: Promise.all — two independent fetches run concurrently, not sequentially
      const [jobs, requests] = await Promise.all([
        customJobService.listForCustomer(user.email),
        customRequestService.getMyRequests(user.email),
      ]);

      // CONCEPT: Set for O(1) lookup — find which request IDs have been promoted to jobs
      const promotedIds = new Set<string>(
        jobs.filter((j) => j.custom_request_id).map((j) => j.custom_request_id!)
      );

      // Unpromoted requests — show them without a job tracker link
      const unpromoted = requests.filter((r) => !promotedIds.has(r.id));

      const unified: UnifiedItem[] = [
        ...jobs.map((j): UnifiedItem => ({ kind: "job", data: j, updatedAt: j.updated_at })),
        ...unpromoted.map((r): UnifiedItem => ({ kind: "request", data: r, updatedAt: r.updated_at })),
      ];

      // Sort by most recently updated
      unified.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setItems(unified);
    } catch (error) {
      toast({
        title: "Failed to load your orders",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">My Custom Orders</h1>
        <p className="mt-2 text-muted-foreground">
          Track your custom jewellery orders and design requests
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center gap-4">
            <Package className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No custom orders yet</p>
            <p className="text-muted-foreground text-sm">
              Submit a custom request to start a bespoke order
            </p>
            <Button onClick={() => navigate("/custom-request")}>
              Submit Custom Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) =>
            item.kind === "job" ? (
              <JobCard key={`job-${item.data.id}`} job={item.data} />
            ) : (
              <RequestCard key={`req-${item.data.id}`} request={item.data} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: CustomJob }) {
  const cfg = JOB_STATUS_CONFIG[job.status] ?? JOB_STATUS_CONFIG.intake;
  const completedMilestones = 0; // milestones not loaded in list view; tracker shows full detail

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{job.job_number}</p>
            <p className="font-semibold">{job.title}</p>
          </div>
          <Badge className={cfg.color}>{cfg.label}</Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Updated {new Date(job.updated_at).toLocaleDateString("en-IN")}</span>
          {job.estimated_ready_date && (
            <>
              <span>·</span>
              <span>Est. ready {new Date(job.estimated_ready_date).toLocaleDateString("en-IN")}</span>
            </>
          )}
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link to={`/track/${job.tracking_token}`}>
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Track production
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestCard({ request }: { request: CustomRequest }) {
  const cfg = REQUEST_STATUS_CONFIG[request.status] ?? REQUEST_STATUS_CONFIG.pending;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Custom Request</p>
            <p className="font-semibold line-clamp-1">{request.description}</p>
          </div>
          <Badge className={cfg.color}>{cfg.label}</Badge>
        </div>

        <div className="text-sm text-muted-foreground">
          Submitted {formatDate(request.created_at)}
        </div>

        {request.admin_response && (
          <>
            <Separator />
            <div className="text-sm">
              <p className="font-medium text-muted-foreground mb-1">Admin Response</p>
              <p className="text-sm line-clamp-2">{request.admin_response}</p>
              {request.estimated_price && (
                <p className="mt-1 font-bold text-base">
                  ₹{request.estimated_price.toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/custom-request/${request.id}`}>View details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
