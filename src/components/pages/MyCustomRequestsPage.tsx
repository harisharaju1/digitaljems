/**
 * My Custom Requests Page
 * View all custom order requests submitted by the user
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Image as ImageIcon, Clock, MessageSquare, CheckCircle, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/hooks/use-toast";
import { customRequestService } from "@/components/lib/sdk";
import { useAuthStore } from "@/components/store/auth-store";
import type { CustomRequest } from "@/components/types";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400", icon: Clock },
  reviewed: { label: "Under Review", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400", icon: MessageSquare },
  quoted: { label: "Quote Sent", color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400", icon: X },
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

export function MyCustomRequestsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuthStore();
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/my-custom-requests" } } });
      return;
    }

    loadRequests();
  }, [isAuthenticated, navigate]);

  const loadRequests = async () => {
    if (!user?.email) return;

    try {
      const data = await customRequestService.getMyRequests(user.email);
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">My Custom Requests</h1>
        <p className="mt-2 text-muted-foreground">
          View all your custom order requests and their status
        </p>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No custom requests yet</p>
            <p className="text-muted-foreground mb-4">
              Submit your first custom request to get started
            </p>
            <Button onClick={() => navigate("/custom-request")}>
              Submit Custom Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const status = statusConfig[request.status] || statusConfig.pending;
            const StatusIcon = status.icon;

            return (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Image */}
                    <div className="h-48 w-full md:w-48 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      <button
                        className="flex h-full w-full items-center justify-center"
                        onClick={() => setFullscreenImage(request.image_url)}
                      >
                        <img
                          src={request.image_url}
                          alt="Request reference"
                          className="h-full w-full object-cover cursor-zoom-in"
                        />
                      </button>
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Submitted {formatDate(request.created_at)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge className={status.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Description
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{request.description}</p>
                      </div>

                      {/* Contact Info */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{request.customer_phone}</span>
                      </div>

                      {/* Admin Response */}
                      {request.admin_response && (
                        <>
                          <Separator />
                          <div className="rounded-lg bg-muted p-4">
                            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                              <MessageSquare className="h-4 w-4" />
                              Admin Response
                            </p>
                            <p className="text-sm whitespace-pre-wrap mb-3">
                              {request.admin_response}
                            </p>
                            {request.estimated_price && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                  Estimated Price
                                </p>
                                <p className="text-xl font-bold">
                                  ₹{request.estimated_price.toLocaleString("en-IN")}
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }          )}
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-4">
            <span className="text-white text-sm">Reference Image</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFullscreenImage(null)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <img
              src={fullscreenImage}
              alt="Request reference"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
