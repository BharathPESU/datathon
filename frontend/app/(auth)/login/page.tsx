"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import { Shield, Lock, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { logIn } = useAuthStore();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Signup Specific States
  const [isSignup, setIsSignup] = useState(false);
  const [signupRole, setSignupRole] = useState("investigator");
  const [employeeId, setEmployeeId] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const empId = employeeId ? parseInt(employeeId, 10) : undefined;
      const response = await api.auth.signup({
        username,
        password,
        role: signupRole,
        employee_id: empId
      });
      setSuccess(response.message || "Registration request submitted for Admin approval!");
      // Reset fields
      setUsername("");
      setPassword("");
      setEmployeeId("");
      // Switch back to login after 4 seconds
      setTimeout(() => {
        setIsSignup(false);
        setSuccess("");
      }, 4000);
    } catch (err: any) {
      setError(err.message || "Failed to submit registration request.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoUser: string, demoPass: string) => {
    setLoading(true);
    setError("");
    setSuccess("");
    
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
          <p className="text-sm text-[var(--foreground-dim)]">
            {isSignup ? "Request access to the database" : "Enter credentials to access police database"}
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-card p-8 space-y-6">
          {!isSignup ? (
            // Login Form
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Username / Gmail</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--foreground-dim)]" />
                  <input 
                    type="text" 
                    className="input pl-10" 
                    placeholder="Enter username or email" 
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

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(true);
                    setError("");
                    setSuccess("");
                  }}
                  className="text-xs text-[var(--primary)] hover:underline font-semibold"
                >
                  Don&apos;t have an account? Request access
                </button>
              </div>
            </form>
          ) : (
            // Signup Form
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--foreground-dim)]" />
                  <input 
                    type="email" 
                    className="input pl-10" 
                    placeholder="name@gmail.com" 
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
                    placeholder="Choose a password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Role</label>
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
                  <label className="block text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Employee ID</label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="e.g. 1045" 
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-[var(--danger-dim)] text-[var(--danger)] text-xs font-medium">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-[var(--primary-glow)]/30 text-[var(--primary)] text-xs font-semibold border border-[var(--primary)]/20">
                  {success}
                </div>
              )}

              <button 
                type="submit" 
                className="btn-primary w-full flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Access Request"}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(false);
                    setError("");
                    setSuccess("");
                  }}
                  className="text-xs text-[var(--foreground-dim)] hover:underline font-semibold"
                >
                  Already have an account? Log in
                </button>
              </div>
            </form>
          )}

          {/* Demo Logins Divider */}
          {!isSignup && (
            <>
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
            </>
          )}
        </div>

      </div>
    </div>
  );
}