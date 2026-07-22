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
    <aside className="w-[var(--sidebar-width)] bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col shrink-0 text-white">
      {/* Brand Header */}
      <div className="h-[var(--header-height)] px-6 border-b border-[var(--sidebar-hover)] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
          <Shield className="w-4 h-4 text-[var(--sidebar-bg)]" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white">KSP Analytics</h1>
          <p className="text-[10px] text-[var(--foreground-dim)] font-semibold uppercase tracking-wider">Crime Intelligence</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-4 space-y-1.5">
        <div className="px-4 mb-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">WORKSPACE</span>
        </div>
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
                  ? "bg-[var(--sidebar-hover)] text-white border-l-2 border-[var(--brand-teal)]" 
                  : "text-slate-400 hover:text-white hover:bg-[var(--sidebar-hover)]"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--brand-teal)]' : ''}`} />
              <span>{link.name}</span>
            </Link>
          );
        })}

        {/* Admin divider & link */}
        {showAdmin && (
          <div className="pt-4 mt-4 border-t border-[var(--sidebar-hover)]">
            <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">SYSTEM</p>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                pathname === "/admin"
                  ? "bg-[var(--sidebar-hover)] text-white border-l-2 border-[var(--brand-teal)]"
                  : "text-slate-400 hover:text-white hover:bg-[var(--sidebar-hover)]"
              }`}
            >
              <Shield className={`w-4 h-4 shrink-0 ${pathname === '/admin' ? 'text-[var(--brand-teal)]' : ''}`} />
              <span>Admin Panel</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User Footer */}
      {user && (
        <div className="p-4 border-t border-[var(--sidebar-hover)] bg-[var(--sidebar-bg)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs uppercase text-white">
              {user.username.substring(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate text-white">{user.username}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}