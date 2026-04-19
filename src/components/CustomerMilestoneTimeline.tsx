import { CheckCircle2, Circle, Clock, SkipForward } from "lucide-react";
import type { CustomJobMilestone, MilestoneName } from "@/components/types";

// CONCEPT: ordered constant — milestone order is fixed regardless of DB insertion order
const MILESTONE_ORDER: MilestoneName[] = [
  "design_approved",
  "cad_ready",
  "wax_model",
  "casting",
  "stone_setting",
  "finishing",
  "qc",
  "ready",
];

const MILESTONE_LABELS: Record<MilestoneName, string> = {
  design_approved: "Design Approved",
  cad_ready: "CAD Ready",
  wax_model: "Wax Model",
  casting: "Casting",
  stone_setting: "Stone Setting",
  finishing: "Finishing",
  qc: "Quality Check",
  ready: "Ready for Delivery",
};

type MilestoneEntry = Pick<CustomJobMilestone, "milestone" | "status" | "photos" | "completed_at">;

interface Props {
  milestones: MilestoneEntry[];
}

const formatDate = (dateString?: string) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function CustomerMilestoneTimeline({ milestones }: Props) {
  // CONCEPT: Map for O(1) lookup — build once at render time, look up in the loop
  const byName = new Map<MilestoneName, MilestoneEntry>(
    milestones.map((m) => [m.milestone, m])
  );

  return (
    <div className="relative">
      {MILESTONE_ORDER.map((name, idx) => {
        const m = byName.get(name);
        const status = m?.status ?? "pending";
        const isLast = idx === MILESTONE_ORDER.length - 1;

        return (
          <div key={name} className="flex gap-4">
            {/* Connector line + icon */}
            <div className="flex flex-col items-center">
              <div className="flex-shrink-0 mt-1">
                {status === "done" && (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                )}
                {status === "in_progress" && (
                  <Clock className="h-6 w-6 text-amber-500 animate-pulse" />
                )}
                {status === "skipped" && (
                  <SkipForward className="h-6 w-6 text-muted-foreground" />
                )}
                {status === "pending" && (
                  <Circle className="h-6 w-6 text-muted-foreground/40" />
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 my-1 min-h-[24px] ${
                    status === "done" ? "bg-green-300" : "bg-border"
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-6 flex-1 ${isLast ? "pb-0" : ""}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span
                  className={`font-medium text-sm ${
                    status === "done"
                      ? "text-foreground"
                      : status === "in_progress"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {MILESTONE_LABELS[name]}
                </span>
                {m?.completed_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(m.completed_at)}
                  </span>
                )}
              </div>

              {/* Photos — first photo shown as thumbnail */}
              {m?.photos && m.photos.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {m.photos.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={url}
                        alt={`${MILESTONE_LABELS[name]} photo ${i + 1}`}
                        className="h-20 w-20 rounded-md object-cover border hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
