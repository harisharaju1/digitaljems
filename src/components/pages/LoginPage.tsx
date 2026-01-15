/**
 * Login Page with Password & Magic Link Authentication
 * - Sign In: Email + Password for returning users
 * - Sign Up: Magic link for new users (then they can set password)
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Mail, ArrowLeft, Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/hooks/use-toast";
import { useAuthStore } from "@/components/store/auth-store";
import { authService } from "@/components/lib/sdk";
import { supabase } from "@/components/lib/supabase";

const isDev = import.meta.env.DEV;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupSent, setSignupSent] = useState(false);

  const rawFrom =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
  // Prevent redirect loop - if from is login page, go to home
  const from = rawFrom === "/login" ? "/" : rawFrom;

  // Listen for auth state changes (magic link callback)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        toast({
          title: "Welcome!",
          description: "You have successfully signed in",
        });
        navigate(from, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, from, toast]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.signInWithPassword(email, password);
      
      if (result.user) {
        authService.storeUserInfo(result.user.id, result.user.email || email, "");
        
        useAuthStore.setState({
          isAuthenticated: true,
          user: {
            uid: result.user.id,
            email: result.user.email || email,
            name: "",
          },
        });

        await useAuthStore.getState().loadProfile();
        await useAuthStore.getState().checkAdminStatus();

        toast({
          title: "Welcome back!",
          description: "You have successfully signed in",
        });

        if (useAuthStore.getState().isAdmin) {
          navigate("/admin", { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.signUpWithPassword(email, password);
      
      // Check if user already exists (Supabase returns user with empty identities)
      if (result.user && result.user.identities?.length === 0) {
        // Try to sign in with the provided password
        try {
          const signInResult = await authService.signInWithPassword(email, password);
          if (signInResult.user) {
            authService.storeUserInfo(signInResult.user.id, signInResult.user.email || email, "");
            useAuthStore.setState({
              isAuthenticated: true,
              user: {
                uid: signInResult.user.id,
                email: signInResult.user.email || email,
                name: "",
              },
            });
            await useAuthStore.getState().loadProfile();
            await useAuthStore.getState().checkAdminStatus();
            toast({
              title: "Welcome back!",
              description: "You already have an account - signed you in",
            });
            navigate(from, { replace: true });
            return;
          }
        } catch {
          // Password didn't match, redirect to sign in
          toast({
            title: "Account already exists",
            description: "Please sign in with your correct password",
            variant: "destructive",
          });
          setActiveTab("signin");
          return;
        }
      }
      
      if (result.user && !result.session) {
        // Email confirmation required
        setSignupSent(true);
        toast({
          title: "Check your email",
          description: "Click the confirmation link to complete signup",
        });
      } else if (result.session) {
        // Auto-confirmed (some Supabase configs)
        authService.storeUserInfo(result.user!.id, result.user!.email || email, "");
        
        useAuthStore.setState({
          isAuthenticated: true,
          user: {
            uid: result.user!.id,
            email: result.user!.email || email,
            name: "",
          },
        });

        toast({
          title: "Account created!",
          description: "Welcome to DJewel Boutique",
        });
        navigate(from, { replace: true });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      
      // Check for user already registered error
      if (errorMessage.toLowerCase().includes("already registered") || 
          errorMessage.toLowerCase().includes("already exists")) {
        toast({
          title: "Account already exists",
          description: "Please sign in instead",
          variant: "destructive",
        });
        setActiveTab("signin");
        return;
      }
      
      toast({
        title: "Sign up failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setSignupSent(false);
  };

  if (signupSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary/30 to-transparent p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Confirmation email sent!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent an email to <span className="font-medium">{email}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Click the link in the email to activate your account.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleSignUp}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resending...
                </>
              ) : (
                "Resend confirmation email"
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                resetForm();
                setActiveTab("signin");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary/30 to-transparent p-4">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "signin" | "signup"); resetForm(); }}>
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="signin" className="text-sm sm:text-base py-2">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm sm:text-base py-2">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 pt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signin-email"
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

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

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
                  </ul>
                </div>
              )}
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 pt-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create password (min 6 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-confirm"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
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
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate(from)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to shop
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
