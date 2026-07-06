import { create } from "zustand";
import api from "@/lib/api";

interface User {
  username: string;
  role: string;
  employee_id?: number;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  logIn: (username: string, token: string, refresh: string, role: string) => void;
  logOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("token") : null,
  refreshToken: typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null,
  user: typeof window !== "undefined" && localStorage.getItem("user") 
    ? JSON.parse(localStorage.getItem("user") || "{}") 
    : null,
  isAuthenticated: typeof window !== "undefined" ? !!localStorage.getItem("token") : false,
  
  logIn: (username, token, refresh, role) => {
    const user = { username, role };
    localStorage.setItem("token", token);
    localStorage.setItem("refreshToken", refresh);
    localStorage.setItem("user", JSON.stringify(user));
    
    set({
      token,
      refreshToken: refresh,
      user,
      isAuthenticated: true
    });
  },
  
  logOut: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    
    set({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false
    });
  }
}));
