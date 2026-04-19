import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/hooks/use-toast";
import { vendorService, adminLogService } from "@/components/lib/sdk";
import type { VendorSpecialty } from "@/components/types";

const ALL_SPECIALTIES: VendorSpecialty[] = ["casting", "stone_setting", "polishing", "cad", "engraving", "assembly"];

export function AdminVendorForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<VendorSpecialty[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    vendorService.get(id).then(v => {
      setName(v.name);
      setPhone(v.phone || "");
      setEmail(v.email || "");
      setSelectedSpecialties(v.specialties);
      setNotes(v.notes || "");
      setIsLoading(false);
    }).catch(() => {
      toast({ title: "Vendor not found", variant: "destructive" });
      navigate("/admin/vendors");
    });
  }, [id]);

  function toggleSpecialty(s: VendorSpecialty) {
    setSelectedSpecialties(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        specialties: selectedSpecialties,
        active: true,
        notes: notes.trim() || undefined,
      };

      if (isEdit) {
        await vendorService.update(id, input);
        await adminLogService.logAction("vendor_updated", "vendor", id, { name: input.name });
        toast({ title: "Vendor updated" });
      } else {
        const vendor = await vendorService.create(input);
        await adminLogService.logAction("vendor_created", "vendor", vendor.id, { name: vendor.name });
        toast({ title: "Vendor created" });
      }

      navigate("/admin/vendors");
    } catch (err) {
      toast({ title: isEdit ? "Update failed" : "Create failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/vendors")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Vendor" : "Add Vendor"}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              id="name"
              label="Name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Karigar or workshop name"
            />
            <FormField
              id="phone"
              label="Phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="9876543210"
            />
            <FormField
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vendor@example.com"
            />

            <div className="space-y-2">
              <Label>Specialties</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_SPECIALTIES.map(s => (
                  <Badge
                    key={s}
                    variant={selectedSpecialties.includes(s) ? "default" : "outline"}
                    className="cursor-pointer capitalize select-none"
                    onClick={() => toggleSpecialty(s)}
                  >
                    {s.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional notes about this vendor..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Vendor"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin/vendors")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
