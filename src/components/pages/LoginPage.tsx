/**
 * Login Page with OTP Authentication
 * In dev mode, supports password login for test users
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Mail, KeyRound, ArrowLeft, Lock } from "lucide-react";
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

type Step = "email" | "otp";

const isDev = import.meta.env.DEV;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { sendOTP, login } = useAuthStore();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDevUser, setIsDevUser] = useState(false);

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleSendOTP = async (e: React.FormEvent) => {
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

    setIsLoading(true);

    try {
      await sendOTP(email);
      setStep("otp");
      
      if (devUser) {
        toast({
          title: "Dev Mode",
          description: "Enter the password for this test account",
        });
      } else {
        toast({
          title: "OTP sent",
          description: "Check your email for the verification code",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to send OTP",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    // For dev users, allow any length password; for OTP, require 6 digits
    if (!isDevUser && (!otp.trim() || otp.length !== 6)) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }

    if (isDevUser && !otp.trim()) {
      toast({
        title: "Password required",
        description: "Please enter the password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, otp);
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in",
      });
      // Redirect admins to admin dashboard
      if (result?.isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (error) {
      toast({
        title: "Verification failed",
        description:
          error instanceof Error ? error.message : "Invalid or expired code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setOtp("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary/30 to-transparent p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Sign in to access your account and orders"
              : "Enter the 6-digit code sent to your email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            /* Email Step */
            <div key="email">
              <form onSubmit={handleSendOTP} className="space-y-4">
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
                      Sending code...
                    </>
                  ) : (
                    "Send verification code"
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

                {/* Dev mode hint */}
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
            </div>
          ) : (
            /* OTP/Password Step */
            <div key="otp">
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">
                    {isDevUser ? "Password" : "Verification Code"}
                  </Label>
                  <div className="relative">
                    {isDevUser ? (
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    ) : (
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    )}
                    <Input
                      id="otp"
                      type={isDevUser ? "password" : "text"}
                      placeholder={isDevUser ? "Enter password" : "000000"}
                      value={otp}
                      onChange={(e) =>
                        isDevUser
                          ? setOtp(e.target.value)
                          : setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      className={isDevUser ? "pl-10" : "pl-10 text-center text-lg tracking-widest"}
                      disabled={isLoading}
                      autoFocus
                      maxLength={isDevUser ? undefined : 6}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isDevUser ? (
                      <span className="text-yellow-600">
                        🔧 Dev Mode: Enter password for <span className="font-medium">{email}</span>
                      </span>
                    ) : (
                      <>Code sent to <span className="font-medium">{email}</span></>
                    )}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="btn-premium w-full"
                  disabled={isLoading || (!isDevUser && otp.length !== 6) || (isDevUser && !otp)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify and Sign In"
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

                {!isDevUser && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={isLoading}
                      className="text-sm text-accent hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  </div>
                )}
              </form>

              {/* Dev mode hint */}
              {isDev && !isDevUser && (
                <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800">
                  <p className="font-semibold">🔧 Dev Mode Test Accounts:</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>admin@test.com / admin123 (Admin)</li>
                    <li>user1@test.com / user123</li>
                    <li>user2@test.com / user123</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
