"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import { Shield, Lock, User, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { logIn } = useAuthStore();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

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

  const handleDemoLogin = async (demoUser: string, demoPass: string) => {
    setLoading(true);
    setError("");
    
    try {
      const response = await api.auth.login({ username: demoUser, password: demoPass });
      logIn(demoUser, response.access_token, response.refresh_token, response.role);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to log in with demo account");
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { label: "Admin", user: "admin", pass: "admin", role: "Administrator" },
    { label: "Investigator", user: "inspector_ravi", pass: "ravi123", role: "Station Officer" },
    { label: "Analyst", user: "analyst_priya", pass: "priya123", role: "Cross-station Trends" },
    { label: "Supervisor", user: "sp_kumar", pass: "kumar123", role: "District Oversight" }
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
          <p className="text-sm text-[var(--foreground-dim)]">Enter credentials to access police database</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--foreground-dim)]" />
                <input 
                  type="text" 
                  className="input pl-10" 
                  placeholder="Enter username" 
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

            {error && (
              <div className="p-3 rounded-lg bg-[var(--danger-dim)] text-[var(--danger)] text-xs font-medium">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Access Platform"}
            </button>
          </form>

          {/* Demo Logins Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[var(--border)]"></div>
            <span className="flex-shrink mx-4 text-[10px] text-[var(--foreground-dim)] uppercase font-bold tracking-wider">Demo Accounts</span>
            <div className="flex-grow border-t border-[var(--border)]"></div>
          </div>

          {/* Quick Logins Grid */}
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.label}
                onClick={() => handleDemoLogin(acc.user, acc.pass)}
                disabled={loading}
                className="btn-secondary text-[11px] p-2 hover:border-[var(--primary)] transition-colors flex flex-col items-center justify-center"
              >
                <span className="font-semibold text-[var(--foreground-muted)]">{acc.label}</span>
                <span className="text-[9px] text-[var(--foreground-dim)] mt-0.5">{acc.role}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}