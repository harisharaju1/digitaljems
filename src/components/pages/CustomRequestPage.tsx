/**
 * Custom Product Request Page
 * Allows logged-in users to upload images and describe custom jewellery requests
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Upload, X, Image as ImageIcon, Send, Clock, CheckCircle, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/hooks/use-toast";
import { useAuthStore } from "@/components/store/auth-store";
import { customRequestService } from "@/components/lib/sdk";
import type { CustomRequest } from "@/components/types";

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800" },
  reviewed: { label: "Under Review", color: "bg-blue-100 text-blue-800" },
  quoted: { label: "Quote Sent", color: "bg-green-100 text-green-800" },
  declined: { label: "Declined", color: "bg-red-100 text-red-800" },
};

export function CustomRequestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user, profile } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<CustomRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/custom-request" } } });
      return;
    }

    // Pre-fill phone from profile if available
    if (profile?.phone) {
      setPhone(profile.phone);
    }

    loadMyRequests();
  }, [isAuthenticated, navigate, profile]);

  const loadMyRequests = async () => {
    if (!user?.email) return;

    try {
      const requests = await customRequestService.getMyRequests(user.email);
      setMyRequests(requests);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast({
        title: "Image required",
        description: "Please upload an image of your desired design",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please describe what you're looking for",
        variant: "destructive",
      });
      return;
    }

    if (!phone.trim() || phone.length < 10) {
      toast({
        title: "Phone number required",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await customRequestService.submitRequest(selectedFile, description, phone, profile?.name);
      toast({
        title: "Request submitted!",
        description: "We'll review your request and get back to you soon.",
      });

      // Reset form
      setDescription("");
      handleRemoveFile();
      loadMyRequests();
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Custom Product Request</h1>
        <p className="mt-2 text-muted-foreground">
          Have a specific design in mind? Upload an image and describe what you're looking for.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Submit New Request */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              New Request
            </CardTitle>
            <CardDescription>
              Upload a reference image and describe your requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Reference Image</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-lg border">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={handleRemoveFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-square w-full max-w-xs flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-primary hover:bg-muted"
                  >
                    <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                    <span className="text-sm font-medium">Click to upload</span>
                    <span className="text-xs text-muted-foreground">
                      PNG, JPG up to 5MB
                    </span>
                  </button>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-xs text-muted-foreground">We'll contact you on this number</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what you're looking for...
                  
• What type of jewellery? (ring, necklace, etc.)
• Preferred metal and purity
• Any specific stones or designs?
• Approximate budget range"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  disabled={isSubmitting}
                />
              </div>

              <Button
                type="submit"
                className="btn-premium w-full"
                disabled={isSubmitting || !selectedFile || !description.trim() || !phone.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Request
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Previous Requests */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">Your Requests</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : myRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  No requests yet. Submit your first custom request!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {myRequests.map((request) => {
                const status = statusConfig[request.status] || statusConfig.pending;

                return (
                  <Card key={request.id}>
                    <CardContent className="pt-4">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                          <img
                            src={request.image_url}
                            alt="Request"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="mb-2 flex items-start justify-between">
                            <p className="text-sm text-muted-foreground">
                              {formatDate(request.created_at)}
                            </p>
                            <Badge className={status.color}>{status.label}</Badge>
                          </div>
                          <p className="line-clamp-2 text-sm">
                            {request.description}
                          </p>
                        </div>
                      </div>

                      {/* Admin Response */}
                      {request.admin_response && (
                        <>
                          <Separator className="my-4" />
                          <div className="rounded-lg bg-muted p-3">
                            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <MessageSquare className="h-3 w-3" />
                              Our Response
                            </p>
                            <p className="text-sm">{request.admin_response}</p>
                            {request.estimated_price && (
                              <p className="mt-2 font-semibold">
                                Estimated Price: ₹{request.estimated_price.toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
