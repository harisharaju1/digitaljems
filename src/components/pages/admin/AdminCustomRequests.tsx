/**
 * Admin Custom Requests Management Page
 * View and respond to customer custom product requests
 */

import { useState, useEffect } from "react";
import { Loader2, MessageSquare, Send, Image as ImageIcon, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  reviewed: { label: "Reviewed", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  quoted: { label: "Quoted", color: "bg-green-100 text-green-800", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-100 text-red-800", icon: XCircle },
};

export function AdminCustomRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CustomRequest | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  
  // Response form
  const [responseText, setResponseText] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [newStatus, setNewStatus] = useState<CustomRequestStatus>("reviewed");

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await customRequestService.getAllRequests();
      setRequests(data);
    } catch (error) {
      toast({
        title: "Failed to load requests",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRequest = (request: CustomRequest) => {
    setSelectedRequest(request);
    setResponseText(request.admin_response || "");
    setEstimatedPrice(request.estimated_price?.toString() || "");
    setNewStatus(request.status === "pending" ? "reviewed" : request.status);
  };

  const handleSendResponse = async () => {
    if (!selectedRequest) return;

    if (!responseText.trim()) {
      toast({
        title: "Response required",
        description: "Please enter a response message",
        variant: "destructive",
      });
      return;
    }

    setIsResponding(true);

    try {
      await customRequestService.respondToRequest(
        selectedRequest.id,
        responseText,
        estimatedPrice ? parseFloat(estimatedPrice) : undefined,
        newStatus
      );

      await adminLogService.logAction(
        "request_responded",
        "request",
        selectedRequest.id,
        { status: newStatus, hasPrice: !!estimatedPrice }
      );

      toast({
        title: "Response sent",
        description: "Your response has been sent to the customer.",
      });

      setSelectedRequest(null);
      loadRequests();
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Custom Requests</h1>
        <p className="text-muted-foreground">
          Review and respond to customer custom product requests
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{requests.length}</p>
            <p className="text-sm text-muted-foreground">Total Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">
              {requests.filter((r) => r.status === "quoted").length}
            </p>
            <p className="text-sm text-muted-foreground">Quoted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-600">
              {requests.filter((r) => r.status === "declined").length}
            </p>
            <p className="text-sm text-muted-foreground">Declined</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No custom requests yet</p>
            <p className="text-muted-foreground">
              Customer requests will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const status = statusConfig[request.status] || statusConfig.pending;
            const StatusIcon = status.icon;

            return (
              <Card
                key={request.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleOpenRequest(request)}
              >
                <CardContent className="pt-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img
                        src={request.image_url}
                        alt="Request"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-medium truncate">{request.customer_email}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(request.created_at)}
                          </p>
                        </div>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>

                      <p className="text-sm line-clamp-2 text-muted-foreground">
                        {request.description}
                      </p>

                      {request.estimated_price && (
                        <p className="mt-2 text-sm font-medium text-green-600">
                          Quoted: ₹{request.estimated_price.toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom Request Details</DialogTitle>
            <DialogDescription>
              Review the request and send a response to the customer
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{selectedRequest.customer_email}</p>
                <p className="text-sm text-muted-foreground">
                  Submitted {formatDate(selectedRequest.created_at)}
                </p>
              </div>

              {/* Image */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Reference Image</p>
                <div className="aspect-video max-w-md overflow-hidden rounded-lg bg-muted">
                  <img
                    src={selectedRequest.image_url}
                    alt="Request reference"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Customer's Description</p>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
              </div>

              <Separator />

              {/* Response Form */}
              <div className="space-y-4">
                <h3 className="font-semibold">Your Response</h3>

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
                    rows={4}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedRequest(null)}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
