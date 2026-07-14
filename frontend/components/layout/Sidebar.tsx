"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { 
  LayoutDashboard, FileText, Users, MessageSquare, 
  TrendingUp, Shield, ShieldAlert, Sparkles 
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, permission: "analytics:basic" },
    { name: "Cases Database", href: "/cases", icon: FileText, permission: "cases:read" },
    { name: "AI Analytics Chat", href: "/chat", icon: MessageSquare, permission: "chat:use" },
    { name: "Network Graph", href: "/network", icon: Users, permission: "network:read" },
    { name: "Trends & Forecasts", href: "/trends", icon: TrendingUp, permission: "forecast:read" },
    { name: "Repeat Offenders", href: "/offenders", icon: ShieldAlert, permission: "risk:read" },
  ];

  const showAdmin = user?.role === "admin" || user?.role === "supervisor";

  const hasPermission = (permission: string) => {
    if (!user) return false;
    const role = user.role.toLowerCase();
    if (role === "admin") return true;
    
    const rolePermissions: Record<string, string[]> = {
      investigator: [
        "analytics:basic", "cases:read", "chat:use", "network:read", "risk:read"
      ],
      analyst: [
        "analytics:basic", "cases:read", "chat:use", "network:read", "forecast:read", "risk:read"
      ],
      supervisor: [
        "analytics:basic", "cases:read", "chat:use", "network:read", "forecast:read", "risk:read", "admin:audit"
      ]
    };
    
    const allowed = rolePermissions[role] || [];
    return allowed.includes(permission);
  };

  return (
    <aside className="w-[var(--sidebar-width)] bg-[var(--surface-dim)] border-r border-[var(--border)] flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-[var(--header-height)] px-6 border-b border-[var(--border)] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">KSP Analytics</h1>
          <p className="text-[10px] text-[var(--foreground-dim)] font-semibold uppercase tracking-wider">Crime Intelligence</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-4 space-y-1.5">
        {links
          .filter((link) => hasPermission(link.permission))
          .map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
          
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary-glow)]" 
                  : "text-[var(--foreground-muted)] hover:text-white hover:bg-[var(--surface)]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{link.name}</span>
            </Link>
          );
        })}

        {/* Admin divider & link */}
        {showAdmin && (
          <div className="pt-4 mt-4 border-t border-[var(--border)]">
            <p className="px-4 text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider mb-2">Management</p>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                pathname === "/admin"
                  ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]"
                  : "text-[var(--foreground-muted)] hover:text-white hover:bg-[var(--surface)]"
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Admin Panel</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User Footer */}
      {user && (
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] flex items-center justify-center font-bold text-xs uppercase text-[var(--primary)]">
              {user.username.substring(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{user.username}</p>
              <p className="text-[10px] text-[var(--foreground-dim)] uppercase font-bold tracking-wider">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}