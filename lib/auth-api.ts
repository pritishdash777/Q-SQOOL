import { AuthResponse, UserProfile, LearningProgress, CloudProject, AuthUser } from "./auth-types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000"
    : "https://q-sqool-api.onrender.com");

const TOKEN_KEY = "q-sqool-access-token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

function removeStoredToken() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function hasAuthToken(): boolean {
  return !!getStoredToken();
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.status === 401) {
      // Unauthorized – clear stored token
      removeStoredToken();
    }
    if (!res.ok) {
      let errorMsg = `HTTP error ${res.status}`;
      try {
        const errJson = await res.json();
        errorMsg = errJson.detail || errorMsg;
      } catch (e) {
        // ignore json parse error
      }
      throw new ApiError(errorMsg, res.status);
    }
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new ApiError("Request timed out", 0);
    }
    // If already an ApiError, rethrow; otherwise wrap
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message ?? "Unknown error", 0);
  }
}

export async function registerUser(email: string, password: string, full_name: string): Promise<AuthResponse> {
  const res = await fetchWithAuth("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name }),
  });
  const data = await res.json();
  setStoredToken(data.access_token);
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetchWithAuth("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  setStoredToken(data.access_token);
  return data;
}

export function logoutUser() {
  removeStoredToken();
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await fetchWithAuth("/api/auth/me");
  return res.json();
}

export async function getProfile(): Promise<UserProfile> {
  const res = await fetchWithAuth("/api/profile");
  return res.json();
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetchWithAuth("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function getProgress(): Promise<LearningProgress[]> {
  const res = await fetchWithAuth("/api/progress");
  return res.json();
}

export async function updateProgress(moduleId: string, progress: number, completed?: boolean, quiz_score?: number): Promise<LearningProgress> {
  const res = await fetchWithAuth(`/api/progress/${moduleId}`, {
    method: "PUT",
    body: JSON.stringify({ progress, completed, quiz_score }),
  });
  return res.json();
}

export async function getProjects(): Promise<CloudProject[]> {
  const res = await fetchWithAuth("/api/projects");
  return res.json();
}

export async function saveProgress(progress: any): Promise<void> {
  await fetchWithAuth("/api/progress", {
    method: "PUT",
    body: JSON.stringify(progress),
  });
}

export async function updateModuleProgress(
  moduleId: string,
  patch: Partial<{ progress: number; completed?: boolean; quiz_score?: number }>
): Promise<LearningProgress> {
  const res = await fetchWithAuth(`/api/progress/modules/${moduleId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function createProject(name: string, circuit_json: any, sdk: string = "Qiskit"): Promise<CloudProject> {
  const res = await fetchWithAuth("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, circuit_json, sdk }),
  });
  return res.json();
}

export async function updateProject(id: string, updates: Partial<CloudProject>): Promise<CloudProject> {
  const res = await fetchWithAuth(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  await fetchWithAuth(`/api/projects/${id}`, { method: "DELETE" });
}
