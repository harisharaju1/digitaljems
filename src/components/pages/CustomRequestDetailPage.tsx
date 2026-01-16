/**
 * Custom Request Detail Page
 * View details of a custom request and add comments
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquare, Send, Clock, CheckCircle, X, Phone, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/hooks/use-toast";
import { customRequestService } from "@/components/lib/sdk";
import { useAuthStore } from "@/components/store/auth-store";
import { supabase } from "@/components/lib/supabase";
import type { CustomRequest } from "@/components/types";

interface Comment {
  id: string;
  request_id: string;
  customer_email: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
}

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

export function CustomRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuthStore();
  const [request, setRequest] = useState<CustomRequest | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: `/custom-request/${id}` } } });
      return;
    }

    if (id) {
      loadRequest();
      loadComments();
    }
  }, [id, isAuthenticated, navigate]);

  const loadRequest = async () => {
    if (!id || !user?.email) return;

    try {
      const requests = await customRequestService.getMyRequests(user.email);
      const foundRequest = requests.find((r) => r.id === id);
      
      if (!foundRequest) {
        toast({
          title: "Request not found",
          variant: "destructive",
        });
        navigate("/my-custom-requests");
        return;
      }

      setRequest(foundRequest);
    } catch (error) {
      toast({
        title: "Failed to load request",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      navigate("/my-custom-requests");
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("custom_request_comments")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Failed to load comments:", error);
    }
  };

  const handleAddComment = async () => {
    if (!id || !user?.email || !newComment.trim()) {
      toast({
        title: "Comment required",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    if (comments.length >= 5) {
      toast({
        title: "Comment limit reached",
        description: "Maximum 5 comments allowed per request",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("custom_request_comments")
        .insert({
          request_id: id,
          customer_email: user.email,
          comment_text: newComment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setComments((prev) => [...prev, data]);
      setNewComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully",
      });
    } catch (error) {
      toast({
        title: "Failed to add comment",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated || isLoading) {
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
  const StatusIcon = status.icon;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/my-custom-requests")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Requests
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Custom Request Details</h1>
            <p className="mt-2 text-muted-foreground">
              Submitted {formatDate(request.created_at)}
            </p>
          </div>
          <Badge className={status.color}>
            <StatusIcon className="h-4 w-4 mr-2" />
            {status.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Request Details */}
        <div className="space-y-6">
          {/* Image */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Reference Image</h2>
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                <button
                  className="flex h-full w-full items-center justify-center"
                  onClick={() => setFullscreenImage(true)}
                >
                  <img
                    src={request.image_url}
                    alt="Request reference"
                    className="h-full w-full object-contain cursor-zoom-in"
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Your Description</h2>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm whitespace-pre-wrap">{request.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{request.customer_phone}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{request.customer_email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Response */}
          {request.admin_response && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Admin Response
                </h2>
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

        {/* Right: Comments Section */}
        <div>
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Comments</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Add up to 5 comments to provide additional information or ask questions about your request.
              </p>

              {/* Add Comment Form */}
              {comments.length < 5 && (
                <div className="mb-6 space-y-3">
                  <Textarea
                    placeholder="Add a comment or question..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={isSubmitting || !newComment.trim()}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Add Comment
                      </>
                    )}
                  </Button>
                </div>
              )}

              {comments.length >= 5 && (
                <div className="mb-6 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  You have reached the maximum of 5 comments for this request.
                </div>
              )}

              <Separator className="mb-4" />

              {/* Comments List */}
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No comments yet. Add your first comment above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border bg-muted/50 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(comment.created_at)}
                        </p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.comment_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-4">
            <span className="text-white text-sm">Reference Image</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFullscreenImage(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <img
              src={request.image_url}
              alt="Request reference"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
