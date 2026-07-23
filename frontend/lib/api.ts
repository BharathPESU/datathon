const getApiBase = () => {
  if (typeof window !== "undefined") {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "https://backend1-50043690275.development.catalystappsail.in/api/v1";
    }
  }
  return "http://localhost:8000/api/v1";
};


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
    const res = await fetch(`${getApiBase()}/auth/refresh`, {
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
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBase()}${endpoint}`, {
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
        if (!(options.body instanceof FormData)) {
          retryHeaders.set("Content-Type", "application/json");
        }
        retryHeaders.set("Authorization", `Bearer ${newToken}`);

        fetch(`${getApiBase()}${endpoint}`, { ...options, headers: retryHeaders })
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
    requestRole: (data: { email: string; role: string; employee_id?: number }) => fetchApi<any>("/auth/request-role", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    googleVerify: (email: string) => fetchApi<any>("/auth/google-verify", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
    me: () => fetchApi<any>("/auth/me"),
    getCustomToken: (email: string) => fetchApi<any>(`/auth/custom-token?email=${encodeURIComponent(email)}`),
  },
  cases: {
    list: (params?: Record<string, any>) => {
      const qs = params ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return fetchApi<any>(`/cases${qs}`);
    },
    searchAccused: (params?: Record<string, any>) => {
      const qs = params ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return fetchApi<any[]>(`/cases/accused/search${qs}`);
    },
    get: (id: number) => fetchApi<any>(`/cases/${id}`),
    create: (data: any) => fetchApi<any>("/cases", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (id: number, data: any) => fetchApi<any>(`/cases/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    addAccused: (caseId: number, data: any) => fetchApi<any>(`/cases/${caseId}/accused`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    updateAccused: (caseId: number, id: number, data: any) => fetchApi<any>(`/cases/${caseId}/accused/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    deleteAccused: (caseId: number, id: number) => fetchApi<any>(`/cases/${caseId}/accused/${id}`, {
      method: "DELETE",
    }),
    addVictim: (caseId: number, data: any) => fetchApi<any>(`/cases/${caseId}/victims`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    updateVictim: (caseId: number, id: number, data: any) => fetchApi<any>(`/cases/${caseId}/victims/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    deleteVictim: (caseId: number, id: number) => fetchApi<any>(`/cases/${caseId}/victims/${id}`, {
      method: "DELETE",
    }),
    addComplainant: (caseId: number, data: any) => fetchApi<any>(`/cases/${caseId}/complainants`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    updateComplainant: (caseId: number, id: number, data: any) => fetchApi<any>(`/cases/${caseId}/complainants/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    deleteComplainant: (caseId: number, id: number) => fetchApi<any>(`/cases/${caseId}/complainants/${id}`, {
      method: "DELETE",
    }),
    addArrest: (caseId: number, data: any) => fetchApi<any>(`/cases/${caseId}/arrests`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    updateArrest: (caseId: number, id: number, data: any) => fetchApi<any>(`/cases/${caseId}/arrests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    deleteArrest: (caseId: number, id: number) => fetchApi<any>(`/cases/${caseId}/arrests/${id}`, {
      method: "DELETE",
    }),
    getSimilarSuspects: (id: number) => fetchApi<any>(`/cases/${id}/similar-suspects`),
  },
  lookups: {
    getMetadata: () => fetchApi<any>("/lookups/metadata"),
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
    listSessions: () => fetchApi<any[]>("/chat/sessions"),
    getHistory: (session_uuid: string) => fetchApi<any[]>(`/chat/session/${session_uuid}/messages`),
    sendMessage: (session_uuid: string, content: string, mode: "database" | "knowledge_base" = "database") =>
      fetchApi<any>(`/chat/session/${session_uuid}/message`, {
        method: "POST",
        body: JSON.stringify({ content, mode }),
      }),
    uploadDocument: (session_uuid: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetchApi<any>(`/chat/session/${session_uuid}/documents`, {
        method: "POST",
        body: fd,
      });
    },
    listDocuments: (session_uuid: string) => fetchApi<any[]>(`/chat/session/${session_uuid}/documents`),
    deleteDocument: (session_uuid: string, fileId: string) => fetchApi<any>(`/chat/session/${session_uuid}/documents/${fileId}`, {
      method: "DELETE",
    }),
    transcribe: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetchApi<any>("/chat/transcribe", {
        method: "POST",
        body: fd,
      });
    },
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
    listPendingUsers: () => fetchApi<any>("/admin/pending-users"),
    approveUser: (email: string) => fetchApi<any>("/admin/users/approve", {
      method: "POST",
      body: JSON.stringify({ email })
    }),
    rejectUser: (email: string) => fetchApi<any>("/admin/users/reject", {
      method: "POST",
      body: JSON.stringify({ email })
    }),
  },
};

export default api;