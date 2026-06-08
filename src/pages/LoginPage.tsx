import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const LoginPage: React.FC = () => {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const getAuthErrorMessage = (err: any) => {
    if (!err) return "Login failed. Please check your credentials and try again.";
    if (err.code) {
      switch (err.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
        case "auth/invalid-email":
          return "Invalid email or password. Please try again.";
        case "auth/too-many-requests":
          return "Too many login attempts. Please wait and try again later.";
        case "auth/user-disabled":
          return "Your account has been disabled. Contact support for help.";
        default:
          break;
      }
    }

    const message = err.message || String(err);
    return message.replace(/^Firebase:\s*/i, "").replace(/^Error\s*\(/i, "").replace(/\)\.?$/, "") || "Login failed. Please check your credentials and try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const errorMsg = getAuthErrorMessage(err);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Enter your email first to receive a reset link");
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(email);
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white p-2 shadow-sm mb-4 border border-border/50">
            <img src="/GCSS-Logoimg.png" alt="GCSS Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold font-display text-foreground">SalesERP</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <Card className="p-8 shadow-2xl border-border/60 bg-card/98 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="rounded-xl h-11 bg-muted/30 border-border/40 focus:border-primary/60 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="rounded-xl h-11 pr-11 bg-muted/30 border-border/40 focus:border-primary/60 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>


            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-primary to-blue-700 hover:from-primary/90 hover:to-blue-700/90 text-white font-semibold rounded-xl transition-all duration-200" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full h-11 text-primary font-medium hover:bg-primary/10 rounded-xl transition-all"
              onClick={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {resetLoading ? "Sending reset link..." : "Forgot password?"}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;
