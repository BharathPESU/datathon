const API_BASE = "http://localhost:8000/api/v1";

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "API Error" }));
    throw new Error(errorData.detail || "Request failed");
  }

  return response.json() as Promise<T>;
}

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
  },
};

export default api;