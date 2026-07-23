"use client";
import { useState, useEffect } from "react";
import { Shield, Users, Database, FileText, Calendar, Clock, Plus, Check, Mail, UserPlus } from "lucide-react";
import api from "@/lib/api";

export default function AdminPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Direct Add User State
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("investigator");
  const [newEmpId, setNewEmpId] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Cloud Seeding State
  const [migrating, setMigrating] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState(false);
  const [migrationError, setMigrationError] = useState("");

  // Pending role access requests
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

  const handleApproveUser = async (email: string) => {
    try {
      await api.admin.approveUser(email);
      await fetchPendingUsers();
      // Reload logs
      const logRes = await api.admin.auditLog({ page: 1, page_size: 10 });
      setLogs(logRes.items || []);
      setTotalLogs(logRes.total || 0);
    } catch (err: any) {
      alert(err.message || "Failed to approve user");
    }
  };

  const handleRejectUser = async (email: string) => {
    if (!confirm(`Are you sure you want to reject access request for ${email}?`)) return;
    try {
      await api.admin.rejectUser(email);
      await fetchPendingUsers();
    } catch (err: any) {
      alert(err.message || "Failed to reject user");
    }
  };

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true);
      try {
        const [logRes, statsRes] = await Promise.all([
          api.admin.auditLog({ page: logPage, page_size: 10 }).catch(() => ({ items: [], total: 0 })),
          api.admin.stats().catch(() => null),
        ]);
        setLogs(logRes.items || []);
        setTotalLogs(logRes.total || 0);
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

  // Admin adding user email directly with role
  const handleAddUserByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    setFormSuccess(false);

    try {
      const empId = newEmpId ? parseInt(newEmpId, 10) : undefined;
      const res = await api.auth.requestRole({
        email: newEmail,
        role: newRole,
        employee_id: empId
      });
      // Directly approve user added by Admin
      await api.admin.approveUser(newEmail);
      
      setFormSuccess(true);
      setNewEmail("");
      setNewEmpId("");
      await fetchPendingUsers();
    } catch (err: any) {
      setFormError(err.message || "Failed to add user");
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
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Supabase & KSP Auth Administration Panel</h2>
        <p className="text-sm text-[var(--foreground-muted)] mt-1">Add users by role, approve access requests for Google OAuth sign-in, and monitor database footprint.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Admin Direct User Provisioning */}
        <div className="chart-container flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <UserPlus className="w-4.5 h-4.5 text-[var(--primary)]" />
              <span>Add & Pre-Approve User Email</span>
            </h3>
            <p className="text-xs text-[var(--foreground-dim)] mb-4">Admin can add an email with a role directly so they can log in via Google OAuth immediately.</p>
          </div>

          <form onSubmit={handleAddUserByAdmin} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider mb-2">User Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-dim)]" />
                <input 
                  type="email" 
                  placeholder="officer@karnataka.gov.in"
                  className="input pl-10" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider mb-2">Assigned Role</label>
                <select 
                  className="input cursor-pointer"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="investigator">Investigator</option>
                  <option value="analyst">Analyst</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider mb-2">Employee ID (Optional)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 2001"
                  className="input" 
                  value={newEmpId}
                  onChange={(e) => setNewEmpId(e.target.value)}
                />
              </div>
            </div>

            {formSuccess && (
              <div className="p-3 bg-[var(--success-dim)] text-[var(--success)] rounded-lg flex items-center gap-2 font-medium">
                <Check className="w-4 h-4" />
                <span>User pre-approved! They can now sign in using Google OAuth.</span>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-[var(--danger-dim)] text-[var(--danger)] rounded-lg font-medium">
                {formError}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2" disabled={formLoading}>
              <Plus className="w-4 h-4" />
              <span>{formLoading ? "Adding..." : "Add & Pre-Approve Google User"}</span>
            </button>
          </form>
        </div>

        {/* Database Footprint */}
        <div className="chart-container flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-[var(--accent)]" />
              <span>Supabase Managed Database</span>
            </h3>
            <p className="text-xs text-[var(--foreground-dim)] mb-4">PostgreSQL tables & active Karnataka FIR records</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[300px] pr-1 text-xs">
            {stats && Object.entries(stats.tables || {}).map(([tbl, cnt]: any) => (
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

      {/* Pending User Access Requests */}
      <div className="chart-container">
        <div className="mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-[var(--primary)]" />
            <span>Pending Role Access Requests</span>
          </h3>
          <p className="text-xs text-[var(--foreground-dim)]">Review user role requests and approve them to grant Google OAuth sign-in permissions.</p>
        </div>

        {pendingLoading ? (
          <div className="text-xs text-[var(--foreground-dim)]">Loading requests...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-4 rounded-lg bg-[var(--surface-dim)]/50 border border-[var(--border)] text-xs text-[var(--foreground-dim)] font-medium text-center">
            No pending access requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Requested Email</th>
                  <th>Requested Role</th>
                  <th>Employee ID</th>
                  <th>Created Via</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u: any) => (
                  <tr key={u.email}>
                    <td className="font-semibold text-[var(--foreground)]">{u.email}</td>
                    <td>
                      <span className="badge badge-secondary uppercase text-[9px]">{u.role}</span>
                    </td>
                    <td>{u.employee_id || "N/A"}</td>
                    <td className="capitalize text-[var(--foreground-dim)]">{u.created_by || "user_request"}</td>
                    <td>
                      <span className={`font-medium flex items-center gap-1.5 ${u.status === 'approved' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        <Clock className="w-3.5 h-3.5 animate-pulse" /> {u.status}
                      </span>
                    </td>
                    <td className="text-right space-x-2">
                      {u.status !== 'approved' && (
                        <button
                          onClick={() => handleApproveUser(u.email)}
                          className="btn-primary py-1 px-3 text-[10px] font-bold inline-flex items-center gap-1 bg-gradient-to-tr from-[var(--success)] to-green-600 border-none text-[var(--foreground)] hover:opacity-90 transition-all shadow-sm"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleRejectUser(u.email)}
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

    </div>
  );
}