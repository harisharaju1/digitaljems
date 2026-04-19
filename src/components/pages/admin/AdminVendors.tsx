import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Archive, Edit, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/hooks/use-toast";
import { vendorService, adminLogService } from "@/components/lib/sdk";
import type { Vendor } from "@/components/types";

export function AdminVendors() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    load();
  }, [showInactive]);

  async function load() {
    try {
      setIsLoading(true);
      const data = await vendorService.list(showInactive ? undefined : { active: true });
      setVendors(data);
    } catch (err) {
      toast({ title: "Failed to load vendors", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleArchive(vendor: Vendor) {
    if (!confirm(`Archive ${vendor.name}? They will no longer appear in job assignments.`)) return;
    try {
      await vendorService.archive(vendor.id);
      await adminLogService.logAction("vendor_updated", "vendor", vendor.id, { action: "archived" });
      toast({ title: `${vendor.name} archived` });
      load();
    } catch {
      toast({ title: "Failed to archive vendor", variant: "destructive" });
    }
  }

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.phone && v.phone.includes(search)) ||
    (v.email && v.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="text-sm text-muted-foreground">Karigar and workshop registry</p>
        </div>
        <Button asChild>
          <Link to="/admin/vendors/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Link>
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or email..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={showInactive ? "default" : "outline"}
          onClick={() => setShowInactive(v => !v)}
        >
          {showInactive ? "All" : "Active only"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading vendors...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No vendors found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(vendor => (
            <Card key={vendor.id} className={vendor.active ? "" : "opacity-60"}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{vendor.name}</p>
                    {vendor.phone && <p className="text-sm text-muted-foreground">{vendor.phone}</p>}
                    {vendor.email && <p className="text-sm text-muted-foreground">{vendor.email}</p>}
                  </div>
                  {!vendor.active && <Badge variant="secondary">Archived</Badge>}
                </div>

                <div className="flex flex-wrap gap-1">
                  {vendor.specialties.map(s => (
                    <Badge key={s} variant="outline" className="text-xs capitalize">
                      {s.replace("_", " ")}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-sm text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-amber-500 stroke-amber-500" />
                  <span>{vendor.reliability_score.toFixed(1)}</span>
                </div>

                {vendor.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{vendor.notes}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" asChild className="flex-1">
                    <Link to={`/admin/vendors/${vendor.id}/edit`}>
                      <Edit className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                  {vendor.active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleArchive(vendor)}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
