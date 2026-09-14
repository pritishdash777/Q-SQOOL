"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Home, Eye, EyeOff, Loader2 } from "lucide-react";
import { registerUser, loginUser } from "@/lib/auth-api";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { Suspense } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/profile";
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        await loginUser(email, password);
        toast.success("Successfully logged in");
      } else {
        if (fullName.trim().length < 2) {
          throw new Error("Full name must be at least 2 characters");
        }
        await registerUser(email, password, fullName);
        toast.success("Account created successfully");
      }
      
      const safeNextPath = nextPath.startsWith("/") ? nextPath : "/profile";
      router.push(safeNextPath);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden quantum-grid">
      <div className="aurora" />
      <div className="noise" />
      <Toaster />
      
      <button 
        onClick={() => router.push("/")}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition z-10"
      >
        <Home className="size-4" /> Back to Home
      </button>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="grid size-16 place-items-center rounded-2xl border border-primary/30 bg-[#070a19] mb-6">
            <Image
              src="/q-sqool-mark.svg"
              alt="Q-SQOOL"
              width={130}
              height={120}
              className="size-12 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isLogin ? "Welcome back" : "Create an account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isLogin ? "Enter your credentials to access your workspace" : "Join Q-SQOOL to save your quantum circuits and progress"}
          </p>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex bg-secondary/10 p-1 rounded-lg mb-6">
            <button 
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${isLogin ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setIsLogin(true)}
            >
              Sign In
            </button>
            <button 
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${!isLogin ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setIsLogin(false)}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="quantum@example.com"
                required
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(187,143,255,.2)] transition hover:shadow-[0_0_30px_rgba(187,143,255,.3)] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-6"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-border/50 pt-6">
            <p className="text-sm text-muted-foreground mb-4">Or explore without saving progress</p>
            <button 
              onClick={() => router.push("/composer")}
              className="text-sm font-medium text-secondary hover:text-secondary/80 transition-colors"
            >
              Continue as Guest &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-primary">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
