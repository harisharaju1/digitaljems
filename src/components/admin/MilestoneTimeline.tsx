import { useState } from "react";
import { CheckCircle2, Circle, Clock, SkipForward, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MilestoneEditor } from "./MilestoneEditor";
import type { CustomJobMilestone, MilestoneName } from "@/components/types";

const MILESTONE_LABELS: Record<MilestoneName, string> = {
  design_approved: "Design Approved",
  cad_ready: "CAD Ready",
  wax_model: "Wax Model",
  casting: "Casting",
  stone_setting: "Stone Setting",
  finishing: "Finishing",
  qc: "Quality Check",
  ready: "Ready for Dispatch",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  done: <CheckCircle2 className="h-5 w-5 text-green-600" />,
  in_progress: <Clock className="h-5 w-5 text-blue-500" />,
  skipped: <SkipForward className="h-5 w-5 text-muted-foreground" />,
  pending: <Circle className="h-5 w-5 text-muted-foreground/40" />,
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  done: { label: "Done", variant: "default" },
  in_progress: { label: "In Progress", variant: "secondary" },
  skipped: { label: "Skipped", variant: "outline" },
  pending: { label: "Pending", variant: "outline" },
};

interface Props {
  jobId: string;
  milestones: CustomJobMilestone[];
  editable?: boolean;
}

export function MilestoneTimeline({ jobId, milestones, editable = true }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [localMilestones, setLocalMilestones] = useState(milestones);

  const MN_ORDER: MilestoneName[] = ["design_approved", "cad_ready", "wax_model", "casting", "stone_setting", "finishing", "qc", "ready"];

  function handleUpdated(updated: CustomJobMilestone) {
    setLocalMilestones(prev => prev.map(m => m.milestone === updated.milestone ? updated : m));
    setExpanded(null);
  }

  return (
    <div className="space-y-0">
      {MN_ORDER.map((name, idx) => {
        const m = localMilestones.find(x => x.milestone === name) || {
          id: `${jobId}-${name}`, job_id: jobId, milestone: name, status: "pending" as const, photos: [],
        };
        const isLast = idx === MN_ORDER.length - 1;
        const isExpanded = expanded === name;
        const badge = STATUS_BADGE[m.status];

        return (
          <div key={name} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className="mt-1">{STATUS_ICON[m.status]}</div>
              {!isLast && <div className={`w-px flex-1 my-1 ${m.status === "done" ? "bg-green-300" : "bg-border"}`} />}
            </div>

            {/* Milestone content */}
            <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${m.status === "pending" ? "text-muted-foreground" : ""}`}>
                      {MILESTONE_LABELS[name]}
                    </span>
                    <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                    {m.photos.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />{m.photos.length}
                      </span>
                    )}
                  </div>
                  {m.note && <p className="text-xs text-muted-foreground mt-0.5">{m.note}</p>}
                  {m.completed_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Completed {new Date(m.completed_at).toLocaleDateString("en-IN")}
                      {m.completed_by && ` by ${m.completed_by}`}
                    </p>
                  )}
                </div>
                {editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setExpanded(isExpanded ? null : name)}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {isExpanded ? "Close" : "Edit"}
                  </Button>
                )}
              </div>

              {/* Photo thumbnails */}
              {m.photos.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {m.photos.map((url, i) => (
                    <img key={i} src={url} alt={`milestone photo ${i + 1}`} className="h-12 w-12 rounded object-cover border" />
                  ))}
                </div>
              )}

              {/* Inline editor */}
              {isExpanded && editable && (
                <MilestoneEditor jobId={jobId} milestone={m} onUpdated={handleUpdated} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
