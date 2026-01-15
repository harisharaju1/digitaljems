/**
 * Login Page with Magic Link Authentication
 * In dev mode, supports password login for test users
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Mail, ArrowLeft, Lock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/hooks/use-toast";
import { useAuthStore } from "@/components/store/auth-store";
import { authService } from "@/components/lib/sdk";
import { supabase } from "@/components/lib/supabase";

type Step = "email" | "sent" | "devPassword";

const isDev = import.meta.env.DEV;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { sendOTP, login } = useAuthStore();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDevUser, setIsDevUser] = useState(false);

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  // Listen for auth state changes (when user clicks magic link)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in",
        });
        navigate(from, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, from, toast]);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Check if dev user
    const devUser = authService.isDevUser(email);
    setIsDevUser(devUser);

    if (devUser) {
      setStep("devPassword");
      toast({
        title: "Dev Mode",
        description: "Enter the password for this test account",
      });
      return;
    }

    setIsLoading(true);

    try {
      await sendOTP(email);
      setStep("sent");
      toast({
        title: "Magic link sent!",
        description: "Check your email and click the link to sign in",
      });
    } catch (error) {
      toast({
        title: "Failed to send magic link",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast({
        title: "Password required",
        description: "Please enter the password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in",
      });
      if (result?.isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description:
          error instanceof Error ? error.message : "Invalid password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setPassword("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary/30 to-transparent p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            {step === "email" && "Sign in to access your account and orders"}
            {step === "sent" && "Check your email for the magic link"}
            {step === "devPassword" && "Enter password for dev account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="btn-premium w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send magic link"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate(from)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to shop
              </Button>

              {isDev && (
                <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800">
                  <p className="font-semibold">🔧 Dev Mode Test Accounts:</p>
                  <ul className="mt-1 space-y-0.5">
                    <li><strong>admin@test.com</strong> / admin123 (Admin)</li>
                    <li><strong>user1@test.com</strong> / user123</li>
                    <li><strong>user2@test.com</strong> / user123</li>
                  </ul>
                </div>
              )}
            </form>
          )}

          {step === "sent" && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <div>
                <p className="font-medium">Magic link sent!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent an email to <span className="font-medium">{email}</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Click the link in the email to sign in. You can close this page.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSendMagicLink}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resending...
                  </>
                ) : (
                  "Resend magic link"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleBackToEmail}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Change email
              </Button>
            </div>
          )}

          {step === "devPassword" && (
            <form onSubmit={handleDevLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <p className="text-sm text-yellow-600">
                  🔧 Dev Mode: Enter password for <span className="font-medium">{email}</span>
                </p>
              </div>

              <Button
                type="submit"
                className="btn-premium w-full"
                disabled={isLoading || !password}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleBackToEmail}
                disabled={isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Change email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
