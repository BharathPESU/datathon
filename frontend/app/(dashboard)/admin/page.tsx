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

  // Cloud Seeding State
  const [migrating, setMigrating] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState(false);
  const [migrationError, setMigrationError] = useState("");

  const handleMigrateCloud = async () => {
    if (!confirm("This will clear your remote Catalyst Data Store tables and seed them with a clean Karnataka Police dataset. Proceed?")) {
      return;
    }
    setMigrating(true);
    setMigrationError("");
    setMigrationSuccess(false);
    try {
      const res = await api.admin.seedCloud();
      if (res.status === "success") {
        setMigrationSuccess(true);
      } else {
        setMigrationError(res.message || "Data store seeding failed.");
      }
    } catch (err: any) {
      setMigrationError(err.message || "Seeding error. If running locally, make sure you are logged in via Catalyst CLI.");
    } finally {
      setMigrating(false);
    }
  };

  // Pending approvals state
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const fetchPendingUsers = async () => {
    setPendingLoading(true);
    try {
      const res = await api.admin.listPendingUsers();
      setPendingUsers(res.users || []);
    } catch (err) {
      console.error("Failed to load pending users", err);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleApproveUser = async (userId: number) => {
    try {
      await api.admin.approveUser(userId);
      await fetchPendingUsers();
      // Reload logs to show user approval entry
      const logRes = await api.admin.auditLog({ page: 1, page_size: 10 });
      setLogs(logRes.items);
      setTotalLogs(logRes.total);
    } catch (err) {
      alert("Failed to approve user");
    }
  };

  const handleRejectUser = async (userId: number) => {
    if (!confirm("Are you sure you want to reject this request?")) return;
    try {
      await api.admin.rejectUser(userId);
      await fetchPendingUsers();
    } catch (err) {
      alert("Failed to reject user");
    }
  };

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true);
      try {
        const [logRes, statsRes] = await Promise.all([
          api.admin.auditLog({ page: logPage, page_size: 10 }),
          api.admin.stats(),
        ]);
        setLogs(logRes.items);
        setTotalLogs(logRes.total);
        setStats(statsRes);
        await fetchPendingUsers();
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
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Surveillance Administration Control</h2>
        <p className="text-sm text-[var(--foreground-muted)] mt-1">Manage users, clear caching, and inspect audit logs</p>
      </div>

      {/* Cloud Migration Action Bar */}
      <div className="glass-card p-5 border-l-4 border-l-[var(--primary)] flex flex-col gap-4 bg-[var(--surface-dim)]/40">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--foreground)]">
              <Database className="w-4.5 h-4.5 text-[var(--primary)]" />
              <span>Zoho Catalyst Cloud Data Store Migration</span>
            </h3>
            <p className="text-xs text-[var(--foreground-dim)]">
              Clear and seed the remote Zoho Catalyst Cloud Data Store tables with Karnataka Police dataset.
            </p>
          </div>
          <button
            onClick={handleMigrateCloud}
            disabled={migrating}
            className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            <span>{migrating ? "Migrating Data..." : "Load Data to Cloud Store"}</span>
          </button>
        </div>

        {migrationSuccess && (
          <div className="p-3 bg-[var(--success-dim)] text-[var(--success)] rounded-lg flex items-center gap-2 text-xs font-medium">
            <Check className="w-4 h-4" />
            <span>Dataset successfully seeded to remote Zoho Catalyst Cloud Data Store (100 Cases / 200+ Accused).</span>
          </div>
        )}

        {migrationError && (
          <div className="p-3 bg-[var(--danger-dim)] text-[var(--danger)] rounded-lg text-xs font-medium">
            {migrationError}
          </div>
        )}
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
                <span className="font-semibold text-[var(--foreground)]">{tbl}</span>
                <span className="badge badge-primary text-[10px]">{cnt} rows</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)] pt-4 mt-4 flex justify-between items-center text-xs">
            <span className="text-[var(--foreground-dim)] font-medium">Total Database Sandbox Footprint:</span>
            <span className="font-bold text-[var(--foreground)] text-sm">{stats?.total_records || 0} records</span>
          </div>
        </div>

      </div>

      {/* Pending User Approvals */}
      <div className="chart-container">
        <div className="mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-[var(--primary)]" />
            <span>Pending Registration Approval Requests</span>
          </h3>
          <p className="text-xs text-[var(--foreground-dim)]">Approve invited Gmail users and grant them their selected database access roles</p>
        </div>

        {pendingLoading ? (
          <div className="text-xs text-[var(--foreground-dim)]">Loading requests...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-4 rounded-lg bg-[var(--surface-dim)]/50 border border-[var(--border)] text-xs text-[var(--foreground-dim)] font-medium text-center">
            No pending registration approval requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Username / Email</th>
                  <th>Requested Role</th>
                  <th>Employee ID</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u: any) => (
                  <tr key={u.user_id}>
                    <td className="font-semibold text-[var(--foreground)]">{u.username}</td>
                    <td>
                      <span className="badge badge-secondary uppercase text-[9px]">{u.role}</span>
                    </td>
                    <td>{u.employee_id || "N/A"}</td>
                    <td>
                      <span className="text-[var(--danger)] font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 animate-pulse" /> Pending Approval
                      </span>
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        onClick={() => handleApproveUser(u.user_id)}
                        className="btn-primary py-1 px-3 text-[10px] font-bold inline-flex items-center gap-1 bg-gradient-to-tr from-[var(--success)] to-green-600 border-none text-[var(--foreground)] hover:opacity-90 transition-all shadow-sm"
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => handleRejectUser(u.user_id)}
                        className="btn-secondary py-1 px-3 text-[10px] font-bold inline-flex items-center gap-1 text-[var(--danger)] border-[var(--danger)]/30 hover:bg-[var(--danger-dim)] transition-all"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <td className="font-semibold text-[var(--foreground)]">
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