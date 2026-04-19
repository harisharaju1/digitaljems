import { useEffect, useState } from "react";
import { Search, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { vendorService } from "@/components/lib/sdk";
import type { Vendor, VendorSpecialty } from "@/components/types";

const ALL_SPECIALTIES: VendorSpecialty[] = ["casting", "stone_setting", "polishing", "cad", "engraving", "assembly"];

interface Props {
  open: boolean;
  currentVendorId?: string;
  onAssign: (vendor: Vendor) => void;
  onClose: () => void;
}

export function JobVendorAssignDialog({ open, currentVendorId, onAssign, onClose }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<VendorSpecialty | "">("");

  useEffect(() => {
    if (open) {
      vendorService.list({ active: true }).then(setVendors).catch(() => {});
    }
  }, [open]);

  const filtered = vendors.filter(v => {
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) || (v.phone || "").includes(search);
    const matchSpecialty = !specialtyFilter || v.specialties.includes(specialtyFilter);
    return matchSearch && matchSpecialty;
  });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Vendor</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search vendors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={!specialtyFilter ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSpecialtyFilter("")}
            >
              All
            </Badge>
            {ALL_SPECIALTIES.map(s => (
              <Badge
                key={s}
                variant={specialtyFilter === s ? "default" : "outline"}
                className="cursor-pointer capitalize"
                onClick={() => setSpecialtyFilter(specialtyFilter === s ? "" : s)}
              >
                {s.replace("_", " ")}
              </Badge>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No vendors found</p>}
            {filtered.map(v => (
              <div
                key={v.id}
                className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted transition-colors ${v.id === currentVendorId ? "border-primary bg-primary/5" : ""}`}
                onClick={() => { onAssign(v); onClose(); }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{v.name}</span>
                    {v.id === currentVendorId && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  {v.phone && <p className="text-xs text-muted-foreground">{v.phone}</p>}
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {v.specialties.map(s => (
                      <Badge key={s} variant="outline" className="text-xs capitalize px-1.5 py-0">
                        {s.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-amber-600 font-medium">★ {v.reliability_score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
