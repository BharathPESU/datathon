const API_BASE = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "https://backend1-50043690275.development.catalystappsail.in/api/v1"
  : "http://localhost:8000/api/v1";


// ─── Token Refresh Helper ──────────────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeToRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function broadcastRefreshDone(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

async function doTokenRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error("Refresh failed");
    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("refreshToken", data.refresh_token);
    return data.access_token;
  } catch {
    // Refresh token also expired — force logout
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
    return null;
  }
}

// ─── Core Fetch Wrapper ───────────────────────────────────────────────────
async function fetchApi<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // ── Auto-refresh on 401 ──────────────────────────────────────────────
  if (response.status === 401 && retry && typeof window !== "undefined") {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await doTokenRefresh();
      isRefreshing = false;

      if (newToken) {
        broadcastRefreshDone(newToken);
        // Retry the original request with the new token
        return fetchApi<T>(endpoint, options, false);
      }
      return Promise.reject(new Error("Session expired. Please log in again."));
    }

    // Another request already started the refresh — wait for it
    return new Promise<T>((resolve, reject) => {
      subscribeToRefresh((newToken) => {
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set("Content-Type", "application/json");
        retryHeaders.set("Authorization", `Bearer ${newToken}`);

        fetch(`${API_BASE}${endpoint}`, { ...options, headers: retryHeaders })
          .then((r) => r.json().then((data) => resolve(data)))
          .catch(reject);
      });
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "API Error" }));
    throw new Error(errorData.detail || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ─── API Surface ─────────────────────────────────────────────────────────
const api = {
  auth: {
    login: (data: any) => fetchApi<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    me: () => fetchApi<any>("/auth/me"),
  },
  cases: {
    list: (params?: Record<string, any>) => {
      const qs = params ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return fetchApi<any>(`/cases${qs}`);
    },
    get: (id: number) => fetchApi<any>(`/cases/${id}`),
  },
  analytics: {
    trends: (params?: Record<string, any>) => {
      const qs = params ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return fetchApi<any>(`/analytics/trends${qs}`);
    },
    demographics: (dimension: string) => fetchApi<any>(`/analytics/demographics?dimension=${dimension}`),
    categoryDistribution: () => fetchApi<any>("/analytics/category-distribution"),
    districtComparison: (params?: Record<string, any>) => {
      const qs = params ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return fetchApi<any>(`/analytics/district-comparison${qs}`);
    },
    kpis: () => fetchApi<any>("/analytics/kpis"),
  },
  network: {
    accused: (id: number, degrees: number = 2) => fetchApi<any>(`/network/accused/${id}?degrees=${degrees}`),
    clusters: (params?: Record<string, any>) => {
      const qs = params ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return fetchApi<any>(`/network/clusters${qs}`);
    },
  },
  risk: {
    accused: (id: number) => fetchApi<any>(`/risk/accused/${id}`),
    repeatOffenders: (params?: Record<string, any>) => {
      const qs = params ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return fetchApi<any>(`/risk/repeat-offenders${qs}`);
    },
  },
  forecast: {
    hotspots: (category_id?: number) => {
      const qs = category_id ? `?category_id=${category_id}` : "";
      return fetchApi<any>(`/forecast/hotspots${qs}`);
    },
    timeline: (steps: number = 6) => fetchApi<any>(`/forecast/timeline?steps=${steps}`),
  },
  chat: {
    createSession: (language: string = "en") => fetchApi<any>("/chat/session", {
      method: "POST",
      body: JSON.stringify({ language }),
    }),
    sendMessage: (session_uuid: string, content: string) => fetchApi<any>(`/chat/session/${session_uuid}/message`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  },
  admin: {
    auditLog: (params?: Record<string, any>) => {
      const qs = params ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return fetchApi<any>(`/admin/audit-log${qs}`);
    },
    users: () => fetchApi<any>("/admin/users"),
    createUser: (data: any) => fetchApi<any>("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    stats: () => fetchApi<any>("/admin/stats"),
    seedCloud: () => fetchApi<any>("/admin/seed-cloud", {
      method: "POST"
    }),
  },
};

export default api;