"use client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { LogOut, Bell, Search, User } from "lucide-react";

export default function Header() {
  const router = useRouter();
  const { user, logOut } = useAuthStore();

  const handleLogout = () => {
    logOut();
    router.push("/login");
  };

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return "Good Morning";
    if (hours < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <header className="h-[var(--header-height)] bg-[var(--surface-dim)] border-b border-[var(--border)] px-6 flex items-center justify-between shrink-0">
      {/* Search Bar Placeholder */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-dim)]" />
        <input 
          type="text" 
          placeholder="Global case search..." 
          className="input pl-9 py-1.5 text-xs" 
          disabled
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Welcome message */}
        <div className="text-right hidden sm:block">
          <p className="text-xs text-[var(--foreground-dim)] font-medium">{getGreeting()},</p>
          <p className="text-sm font-semibold capitalize">{user?.username.replace("_", " ")}</p>
        </div>

        {/* Vertical divider */}
        <div className="w-[1px] h-6 bg-[var(--border)] hidden sm:block" />

        {/* User Icon */}
        <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center">
          <User className="w-4 h-4 text-[var(--foreground-muted)]" />
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
