"use client";
import { useState, useEffect } from "react";
import { Shield, Users, Database, FileText, Calendar, Clock, Plus, Check } from "lucide-react";
import api from "@/lib/api";

export default function AdminPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New User Form State
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("investigator");
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true);
      try {
        const [logRes, statsRes] = await Promise.all([
          api.admin.auditLog({ page: logPage, page_size: 10 }),
          api.admin.stats()
        ]);
        setLogs(logRes.items);
        setTotalLogs(logRes.total);
        setStats(statsRes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, [logPage]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    setFormSuccess(false);

    try {
      await api.admin.createUser({
        username: newUsername,
        password: newPassword,
        role: newRole
      });
      setFormSuccess(true);
      setNewUsername("");
      setNewPassword("");
      // Reload logs to show user creation audit entry
      const logRes = await api.admin.auditLog({ page: 1, page_size: 10 });
      setLogs(logRes.items);
      setTotalLogs(logRes.total);
      setLogPage(1);
    } catch (err: any) {
      setFormError(err.message || "Failed to create user");
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="skeleton h-80 rounded-xl" />
          <div className="skeleton h-80 rounded-xl" />
        </div>
        <div className="skeleton h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold gradient-text">Surveillance Administration Control</h2>
        <p className="text-xs text-[var(--foreground-dim)]">Compliance audits, table stats, and identity provisioning controls</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* User Provisioning Form */}
        <div className="chart-container flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-[var(--primary)]" />
              <span>Provision Operational Identity</span>
            </h3>
            <p className="text-xs text-[var(--foreground-dim)] mb-4">Create new KSP logins with role-scoped permissions</p>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider mb-2">Username</label>
              <input 
                type="text" 
                placeholder="e.g. officer_raj"
                className="input" 
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider mb-2">Secret Password</label>
              <input 
                type="password" 
                placeholder="••••••••"
                className="input" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider mb-2">Security Authorization Role</label>
              <select 
                className="input cursor-pointer"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="investigator">Investigator (Own Station Scope)</option>
                <option value="analyst">Analyst (Cross-Station Scope)</option>
                <option value="supervisor">Supervisor (District Scope)</option>
                <option value="admin">Administrator (Global Scope)</option>
              </select>
            </div>

            {formSuccess && (
              <div className="p-3 bg-[var(--success-dim)] text-[var(--success)] rounded-lg flex items-center gap-2 font-medium">
                <Check className="w-4 h-4" />
                <span>Identity provisioned successfully.</span>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-[var(--danger-dim)] text-[var(--danger)] rounded-lg font-medium">
                {formError}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2" disabled={formLoading}>
              <Plus className="w-4 h-4" />
              <span>{formLoading ? "Provisioning..." : "Provision Account"}</span>
            </button>
          </form>
        </div>

        {/* Database Footprint */}
        <div className="chart-container flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-[var(--accent)]" />
              <span>Catalyst Sandboxed Storage</span>
            </h3>
            <p className="text-xs text-[var(--foreground-dim)] mb-4">Row counts and table structures in active local database</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[300px] pr-1 text-xs">
            {stats && Object.entries(stats.tables).map(([tbl, cnt]: any) => (
              <div key={tbl} className="flex items-center justify-between p-3 bg-[var(--surface-dim)]/50 border border-[var(--border)] rounded-lg">
                <span className="font-semibold text-white">{tbl}</span>
                <span className="badge badge-primary text-[10px]">{cnt} rows</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)] pt-4 mt-4 flex justify-between items-center text-xs">
            <span className="text-[var(--foreground-dim)] font-medium">Total Database Sandbox Footprint:</span>
            <span className="font-bold text-white text-sm">{stats?.total_records || 0} records</span>
          </div>
        </div>

      </div>

      {/* Compliance Audit Logs */}
      <div className="chart-container">
        <div className="mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Shield className="w-4.5 h-4.5 text-[var(--success)]" />
            <span>Operational Compliance Audit Trails</span>
          </h3>
          <p className="text-xs text-[var(--foreground-dim)]">GDPR logs auditing investigator queries and login sessions</p>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Compliance Action</th>
                <th>Operator</th>
                <th>Entity Target</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.ROWID}>
                  <td className="font-semibold text-white">
                    <span className={`badge ${
                      l.action === "LOGIN" ? "badge-success" : "badge-info"
                    }`}>{l.action}</span>
                  </td>
                  <td>{l.username || `User #${l.user_id}`}</td>
                  <td className="font-mono text-[10px] text-[var(--foreground-dim)]">{l.resource_type}: {l.resource_ids || "N/A"}</td>
                  <td className="text-[var(--foreground-dim)]">{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}