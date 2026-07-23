"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { Shield, Lock, User, Mail, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { logIn } = useAuthStore();
  const supabase = createClient();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Mode: "admin" | "request"
  const [mode, setMode] = useState<"login" | "request">("login");
  const [requestEmail, setRequestEmail] = useState("");
  const [signupRole, setSignupRole] = useState("investigator");
  const [employeeId, setEmployeeId] = useState("");

  // Handle Google OAuth callback & verification
  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        setError("Google authentication error: " + sessionError.message);
        return;
      }

      if (session?.user?.email) {
        setLoading(true);
        try {
          // Verify if user email is approved by Admin
          const res = await api.auth.googleVerify(session.user.email);
          logIn(session.user.email, res.access_token, res.refresh_token, res.role);
          router.push("/");
        } catch (err: any) {
          setError(err.message || "Your Google account is not approved by Admin.");
          // Sign out from Supabase if unapproved
          await supabase.auth.signOut();
        } finally {
          setLoading(false);
        }
      }
    };

    handleAuthCallback();
  }, []);

  // Admin Username/Password Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.auth.login({ username, password });
      logIn(username, response.access_token, response.refresh_token, response.role);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : "https://laumrpmclobxuwcfepww.supabase.co/auth/v1/callback",
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate Google Sign-In");
      setLoading(false);
    }
  };

  // Submit Role Request (Email only, no password)
  const handleRequestRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const empId = employeeId ? parseInt(employeeId, 10) : undefined;
      const response = await api.auth.requestRole({
        email: requestEmail,
        role: signupRole,
        employee_id: empId
      });
      
      setSuccess(response.message || "Access request submitted! Admin will review your role request.");
      setRequestEmail("");
      setEmployeeId("");
      
      setTimeout(() => {
        setMode("login");
        setSuccess("");
      }, 5000);
    } catch (err: any) {
      setError(err.message || "Failed to submit role access request.");
    } finally {
      setLoading(false);
    }
  };

  // Direct Trail/Demo Login (No Auth Required)
  const handleDemoTrailLogin = (demoRole: string) => {
    const demoUserMap: Record<string, string> = {
      admin: "admin",
      investigator: "inspector_ravi",
      analyst: "analyst_priya",
      supervisor: "sp_kumar"
    };

    const user = demoUserMap[demoRole] || "trail_guest";
    logIn(user, "demo-trail-token", "demo-trail-refresh", demoRole);
    router.push("/");
  };

  const demoAccounts = [
    { label: "Admin Trial", role: "admin", desc: "Full Admin Panel Access" },
    { label: "Investigator Trial", role: "investigator", desc: "Station Crime Analytics" },
    { label: "Analyst Trial", role: "analyst", desc: "Cross-station Trends" },
    { label: "Supervisor Trial", role: "supervisor", desc: "District Oversight" }
  ];

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--accent)] flex items-center justify-center mx-auto shadow-lg shadow-[var(--primary-glow)]">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">KSP Crime Intelligence</h2>
          <p className="text-sm text-[var(--foreground-dim)]">
            {mode === "request" 
              ? "Request role-based access with your email" 
              : "Karnataka Police Portal Authentication"}
          </p>
        </div>

        {/* Card Container */}
        <div className="glass-card p-8 space-y-6">

          {error && (
            <div className="p-3 rounded-lg bg-[var(--danger-dim)] text-[var(--danger)] text-xs font-medium border border-[var(--danger)]/20">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-[var(--primary-glow)]/30 text-[var(--primary)] text-xs font-semibold border border-[var(--primary)]/20">
              {success}
            </div>
          )}

          {mode === "login" ? (
            <div className="space-y-5">
              
              {/* 1. Google OAuth Button (For Approved Users / Admin Added Emails) */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-[var(--border)] bg-white/5 hover:bg-white/10 transition-colors font-medium text-sm text-[var(--foreground)]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Sign in with Google (Approved Users)
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[var(--border)]"></div>
                <span className="flex-shrink mx-3 text-[10px] text-[var(--foreground-dim)] uppercase font-bold tracking-wider">Or Admin Login</span>
                <div className="flex-grow border-t border-[var(--border)]"></div>
              </div>

              {/* 2. Admin Username & Password Form */}
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--foreground-dim)]" />
                    <input 
                      type="text" 
                      className="input pl-10" 
                      placeholder="bharath or admin" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--foreground-dim)]" />
                    <input 
                      type="password" 
                      className="input pl-10" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary w-full flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Admin Access Login"}
                </button>
              </form>

              {/* 3. Link for Requesting Access Role */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("request");
                    setError("");
                    setSuccess("");
                  }}
                  className="text-xs text-[var(--primary)] hover:underline font-semibold flex items-center justify-center gap-1.5 mx-auto"
                >
                  <Mail className="w-3.5 h-3.5" />
                  New User? Request Role Access (No Password Required)
                </button>
              </div>

            </div>
          ) : (
            // Request Role Access Form (Only Email, No Password)
            <form onSubmit={handleRequestRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Official Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--foreground-dim)]" />
                  <input 
                    type="email" 
                    className="input pl-10" 
                    placeholder="officer@karnataka.gov.in" 
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Requested Role</label>
                  <select
                    className="input"
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                  >
                    <option value="investigator">Investigator</option>
                    <option value="analyst">Analyst</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Employee ID (Optional)</label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="e.g. 2001" 
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-[11px] text-[var(--foreground-dim)] bg-white/5 p-2.5 rounded-lg border border-[var(--border)]">
                💡 No password is required. Once approved by an Admin, you will log in securely via <strong>Google Sign-In</strong>.
              </p>

              <button 
                type="submit" 
                className="btn-primary w-full flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Role Access Request"}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setSuccess("");
                  }}
                  className="text-xs text-[var(--foreground-dim)] hover:underline font-semibold"
                >
                  ← Back to Login Options
                </button>
              </div>
            </form>
          )}

          {/* 4. Demo Trail Accounts Section */}
          <div className="space-y-3 pt-2">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-[var(--border)]"></div>
              <span className="flex-shrink mx-3 text-[10px] text-[var(--primary)] uppercase font-bold tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Demo Trial Accounts (No Auth)
              </span>
              <div className="flex-grow border-t border-[var(--border)]"></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.label}
                  onClick={() => handleDemoTrailLogin(acc.role)}
                  disabled={loading}
                  className="btn-secondary text-[11px] p-2.5 hover:border-[var(--primary)] transition-all flex flex-col items-center justify-center text-center"
                >
                  <span className="font-semibold text-[var(--foreground-muted)]">{acc.label}</span>
                  <span className="text-[9px] text-[var(--foreground-dim)] mt-0.5">{acc.desc}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}