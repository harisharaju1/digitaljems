/**
 * Admin Custom Request Detail Page
 * View and respond to a specific custom request
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquare, Send, Phone, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { customRequestService, adminLogService } from "@/components/lib/sdk";
import type { CustomRequest, CustomRequestStatus } from "@/components/types";

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400" },
  reviewed: { label: "Under Review", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" },
  quoted: { label: "Quote Sent", color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" },
  declined: { label: "Declined", color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" },
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function AdminCustomRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [request, setRequest] = useState<CustomRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  
  // Response form
  const [responseText, setResponseText] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [newStatus, setNewStatus] = useState<CustomRequestStatus>("reviewed");

  useEffect(() => {
    if (id) {
      loadRequest(id);
    }
  }, [id]);

  const loadRequest = async (requestId: string) => {
    try {
      const requests = await customRequestService.getAllRequests();
      const foundRequest = requests.find((r) => r.id === requestId);
      
      if (!foundRequest) {
        toast({
          title: "Request not found",
          variant: "destructive",
        });
        navigate("/admin/custom-requests");
        return;
      }

      setRequest(foundRequest);
      setResponseText(foundRequest.admin_response || "");
      setEstimatedPrice(foundRequest.estimated_price?.toString() || "");
      setNewStatus(foundRequest.status === "pending" ? "reviewed" : foundRequest.status);
    } catch (error) {
      toast({
        title: "Failed to load request",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      navigate("/admin/custom-requests");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResponse = async () => {
    if (!request || !responseText.trim()) {
      toast({
        title: "Validation error",
        description: "Response message is required",
        variant: "destructive",
      });
      return;
    }

    setIsResponding(true);

    try {
      const price = newStatus === "quoted" && estimatedPrice ? parseFloat(estimatedPrice) : undefined;

      await customRequestService.respondToRequest(
        request.id,
        responseText,
        price,
        newStatus
      );

      await adminLogService.logAction("request_responded", "request", request.id, {
        status: newStatus,
        hasPrice: !!price,
      });

      toast({
        title: "Response sent",
        description: "Your response has been sent to the customer",
      });

      // Reload request to show updated status
      await loadRequest(request.id);
    } catch (error) {
      toast({
        title: "Failed to send response",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return null;
  }

  const status = statusConfig[request.status] || statusConfig.pending;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin/custom-requests")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Requests
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Custom Request Details</h1>
            <p className="mt-2 text-muted-foreground">
              Review and respond to the customer's request
            </p>
          </div>
          <Badge className={status.color}>{status.label}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Request Details */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
              <div className="space-y-3">
                {request.customer_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{request.customer_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{request.customer_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`tel:${request.customer_phone}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {request.customer_phone}
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://wa.me/${request.customer_phone.replace(/[^0-9]/g, '')}`, '_blank')}
                    >
                      WhatsApp
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="text-sm">{formatDate(request.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Image */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Reference Image</h2>
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                <img
                  src={request.image_url}
                  alt="Request reference"
                  className="h-full w-full object-contain cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => window.open(request.image_url, '_blank')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Customer's Description</h2>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm whitespace-pre-wrap">{request.description}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Response Form */}
        <div>
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Send Response</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as CustomRequestStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reviewed">Under Review</SelectItem>
                      <SelectItem value="quoted">Send Quote</SelectItem>
                      <SelectItem value="declined">Decline Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newStatus === "quoted" && (
                  <div className="space-y-2">
                    <Label htmlFor="price">Estimated Price (₹)</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="Enter estimated price"
                      value={estimatedPrice}
                      onChange={(e) => setEstimatedPrice(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="response">Response Message</Label>
                  <Textarea
                    id="response"
                    placeholder="Write your response to the customer..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={6}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/admin/custom-requests")}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendResponse}
                    disabled={isResponding}
                    className="flex-1"
                  >
                    {isResponding ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Response
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Previous Response (if exists) */}
          {request.admin_response && (
            <Card className="mt-6">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Previous Response</h2>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm whitespace-pre-wrap mb-3">
                    {request.admin_response}
                  </p>
                  {request.estimated_price && (
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Estimated Price
                      </p>
                      <p className="text-xl font-bold">
                        ₹{request.estimated_price.toLocaleString("en-IN")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
