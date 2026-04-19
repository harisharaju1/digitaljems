import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { customJobService, adminLogService } from "@/components/lib/sdk";
import type { CustomJob, CustomJobStatus } from "@/components/types";

// CONCEPT: grouped kanban columns — each column maps many statuses to one drop target;
// dragging onto a column sets the job to the column's "entry" status.
const KANBAN_COLUMNS: { id: CustomJobStatus; label: string; statuses: CustomJobStatus[] }[] = [
  { id: "intake", label: "Intake", statuses: ["intake"] },
  { id: "design", label: "Design / Quoted", statuses: ["design", "quoted", "approved"] },
  { id: "deposit_pending", label: "Deposit Pending", statuses: ["deposit_pending"] },
  { id: "in_production", label: "In Production", statuses: ["in_production"] },
  { id: "qc", label: "QC", statuses: ["qc"] },
  { id: "ready_for_dispatch", label: "Ready", statuses: ["ready_for_dispatch"] },
  { id: "dispatched", label: "Dispatched / Done", statuses: ["dispatched", "delivered"] },
];

const STATUS_COLOR: Record<string, string> = {
  intake: "bg-slate-100 text-slate-700",
  design: "bg-blue-100 text-blue-700",
  quoted: "bg-cyan-100 text-cyan-700",
  approved: "bg-indigo-100 text-indigo-700",
  deposit_pending: "bg-amber-100 text-amber-700",
  in_production: "bg-orange-100 text-orange-700",
  qc: "bg-purple-100 text-purple-700",
  ready_for_dispatch: "bg-green-100 text-green-700",
  dispatched: "bg-teal-100 text-teal-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  on_hold: "bg-gray-100 text-gray-600",
};

const SOURCE_LABELS: Record<string, string> = { custom_request: "Custom Request", mto: "MTO", admin_manual: "Manual" };

function JobCard({ job, onClick, onDragStart }: { job: CustomJob; onClick: () => void; onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow select-none space-y-2"
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-mono text-muted-foreground">{job.job_number}</span>
        <Badge variant="outline" className={`text-xs ${STATUS_COLOR[job.status] || ""}`}>{job.status.replace(/_/g, " ")}</Badge>
      </div>
      <p className="text-sm font-medium leading-snug line-clamp-2">{job.title}</p>
      <p className="text-xs text-muted-foreground">{job.customer_email}</p>
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">{SOURCE_LABELS[job.source] || job.source}</Badge>
        {job.estimated_ready_date && (
          <span className="text-xs text-muted-foreground">{new Date(job.estimated_ready_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
        )}
      </div>
    </div>
  );
}

export function AdminCustomJobs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<CustomJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setIsLoading(true);
      const data = await customJobService.list();
      setJobs(data);
    } catch {
      toast({ title: "Failed to load jobs", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = jobs.filter(j => {
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (sourceFilter !== "all" && j.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!j.customer_email.includes(q) && !j.job_number.toLowerCase().includes(q) && !j.title.toLowerCase().includes(q)) return false;
    }
    return true;
  }).filter(j => j.status !== "cancelled" && j.status !== "on_hold");

  const closedJobs = jobs.filter(j => j.status === "cancelled" || j.status === "on_hold");

  async function handleDrop(targetStatus: CustomJobStatus) {
    if (!dragJobId) return;
    const job = jobs.find(j => j.id === dragJobId);
    if (!job || job.status === targetStatus) { setDragJobId(null); setDragOverCol(null); return; }

    const prevStatus = job.status;
    setJobs(prev => prev.map(j => j.id === dragJobId ? { ...j, status: targetStatus } : j));
    setDragJobId(null);
    setDragOverCol(null);

    try {
      // CONCEPT: optimistic update — update UI immediately, then confirm with server
      await customJobService.update(dragJobId, { status: targetStatus });
      await adminLogService.logAction("job_status_changed", "job", dragJobId, { from: prevStatus, to: targetStatus });
    } catch {
      setJobs(prev => prev.map(j => j.id === dragJobId ? { ...j, status: prevStatus } : j));
      toast({ title: "Failed to update job status", variant: "destructive" });
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading jobs...</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Jobs</h1>
          <p className="text-sm text-muted-foreground">{jobs.length} total jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search job, email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["intake","design","quoted","approved","deposit_pending","in_production","qc","ready_for_dispatch","dispatched","delivered","on_hold","cancelled"].map(s => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All sources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="custom_request">Custom Request</SelectItem>
            <SelectItem value="mto">MTO</SelectItem>
            <SelectItem value="admin_manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === "kanban" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {KANBAN_COLUMNS.map(col => {
              const colJobs = filtered.filter(j => col.statuses.includes(j.status));
              const isDragTarget = dragOverCol === col.id;
              return (
                <div
                  key={col.id}
                  className={`w-60 rounded-xl border-2 transition-colors ${isDragTarget ? "border-primary bg-primary/5" : "border-transparent bg-muted/40"}`}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
                  onDragLeave={() => setDragOverCol(null)}
                  // CONCEPT: HTML5 DnD — onDrop fires when the dragged element is released
                  // over this column; we read the job ID from dataTransfer and update status.
                  onDrop={e => { e.preventDefault(); handleDrop(col.id); }}
                >
                  <div className="p-3 border-b">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{col.label}</span>
                      <Badge variant="secondary" className="text-xs">{colJobs.length}</Badge>
                    </div>
                  </div>
                  <div className="p-2 space-y-2 min-h-24">
                    {colJobs.map(job => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onClick={() => navigate(`/admin/custom-jobs/${job.id}`)}
                        onDragStart={e => {
                          e.dataTransfer.setData("jobId", job.id);
                          setDragJobId(job.id);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Job #", "Title", "Customer", "Source", "Status", "Vendor", "Est. Ready"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(job => (
                <tr key={job.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/admin/custom-jobs/${job.id}`)}>
                  <td className="px-4 py-2.5 font-mono text-xs">{job.job_number}</td>
                  <td className="px-4 py-2.5 max-w-xs truncate">{job.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{job.customer_email}</td>
                  <td className="px-4 py-2.5"><Badge variant="secondary" className="text-xs">{SOURCE_LABELS[job.source]}</Badge></td>
                  <td className="px-4 py-2.5"><Badge className={`text-xs ${STATUS_COLOR[job.status] || ""}`}>{job.status.replace(/_/g, " ")}</Badge></td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{job.vendor_id || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{job.estimated_ready_date ? new Date(job.estimated_ready_date).toLocaleDateString("en-IN") : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No jobs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Closed / on-hold jobs */}
      {closedJobs.length > 0 && (
        <details className="rounded-lg border">
          <summary className="px-4 py-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/30">
            Closed / On Hold ({closedJobs.length})
          </summary>
          <div className="divide-y">
            {closedJobs.map(job => (
              <div key={job.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20" onClick={() => navigate(`/admin/custom-jobs/${job.id}`)}>
                <span className="font-mono text-xs text-muted-foreground w-28">{job.job_number}</span>
                <span className="text-sm flex-1 truncate">{job.title}</span>
                <Badge className={`text-xs ${STATUS_COLOR[job.status]}`}>{job.status}</Badge>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
