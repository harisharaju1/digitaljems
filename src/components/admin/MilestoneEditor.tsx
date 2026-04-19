import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { customJobService, adminLogService } from "@/components/lib/sdk";
import type { CustomJobMilestone, MilestoneName } from "@/components/types";

const MAX_PHOTOS = 5;
const MAX_SIZE_MB = 10;

interface Props {
  jobId: string;
  milestone: CustomJobMilestone;
  onUpdated: (updated: CustomJobMilestone) => void;
}

export function MilestoneEditor({ jobId, milestone, onUpdated }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(milestone.status);
  const [note, setNote] = useState(milestone.note || "");
  const [photos, setPhotos] = useState<string[]>(milestone.photos);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (photos.length + files.length > MAX_PHOTOS) {
      toast({ title: `Maximum ${MAX_PHOTOS} photos per milestone`, variant: "destructive" });
      return;
    }

    for (const file of files) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast({ title: `${file.name} exceeds ${MAX_SIZE_MB}MB limit`, variant: "destructive" });
        return;
      }
    }

    setIsUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(f => customJobService.uploadMilestonePhoto(jobId, milestone.milestone, f))
      );
      setPhotos(prev => [...prev, ...uploaded]);
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const updated = await customJobService.setMilestone(jobId, milestone.milestone, { status, note: note.trim() || undefined, photos });
      await adminLogService.logAction("milestone_updated", "milestone", `${jobId}:${milestone.milestone}`, { status, note: note.trim() });
      onUpdated(updated);
      toast({ title: "Milestone updated" });
    } catch {
      toast({ title: "Failed to update milestone", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={v => setStatus(v as CustomJobMilestone["status"])}>
          <SelectTrigger className="h-8 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..." rows={2} className="resize-none" />
      </div>

      <div className="space-y-1.5">
        <Label>Photos ({photos.length}/{MAX_PHOTOS})</Label>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {photos.map((url, i) => (
              <div key={i} className="relative group h-16 w-16 overflow-hidden rounded-md border">
                <img src={url} alt={`photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
              Upload Photos
            </Button>
          </>
        )}
      </div>

      <Button size="sm" onClick={handleSave} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        Save
      </Button>
    </div>
  );
}
