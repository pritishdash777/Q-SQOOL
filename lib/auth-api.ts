import type { AuthResponse, UserProfile, LearningProgress, CloudProject, AuthUser } from "./auth-types";
import type { UserProgress } from "./progress-types";
import type { Circuit } from "./quantum-types";
import { ApiError, requestJSON } from "./api";
export { ApiError } from "./api";

const TOKEN_KEY = "q-sqool-access-token";
const USER_KEY = "q-sqool-auth-user";
export const AUTH_CHANGED = "q-sqool-auth-changed";
export type AuthRequest = { token?: string | null; signal?: AbortSignal };

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getCachedUser(): AuthUser | null {
  try {
    const cached = JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    return cached?.token === getStoredToken() ? cached.user : null;
  } catch { return null; }
}

function setStoredAuth(data: AuthResponse) {
  sessionStorage.setItem(USER_KEY, JSON.stringify({ token: data.access_token, user: data.user }));
  sessionStorage.setItem(TOKEN_KEY, data.access_token);
  window.dispatchEvent(new Event(AUTH_CHANGED));
}

function removeStoredToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED));
}

export function hasAuthToken(): boolean { return !!getStoredToken(); }

async function fetchWithAuth<T>(endpoint: string, options: RequestInit & AuthRequest = {}): Promise<T> {
  const { token = getStoredToken(), ...request } = options;
  const publicEndpoint = endpoint === "/api/auth/login" || endpoint === "/api/auth/register";
  if (!publicEndpoint && (!token || token !== getStoredToken())) {
    throw new ApiError("Your session changed. Please sign in again.", 401);
  }
  try {
    return await requestJSON<T>(endpoint, {
      ...request,
      headers: { "Content-Type": "application/json", ...request.headers,
        ...(!publicEndpoint && token ? { Authorization: `Bearer ${token}` } : {}) },
    }, 10000);
  } catch (error) {
    if (!publicEndpoint && error instanceof ApiError && error.status === 401 && getStoredToken() === token) {
      removeStoredToken();
    }
    throw error;
  }
}

export async function registerUser(email: string, password: string, full_name: string): Promise<AuthResponse> {
  const data = await fetchWithAuth<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name }),
  });
  setStoredAuth(data);
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const data = await fetchWithAuth<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setStoredAuth(data);
  return data;
}

export function logoutUser() {
  removeStoredToken();
}

export async function getCurrentUser(options: AuthRequest = {}): Promise<AuthUser> {
  const token = options.token ?? getStoredToken();
  const user = await fetchWithAuth<AuthUser>("/api/auth/me", { ...options, token });
  if (getStoredToken() === token) sessionStorage.setItem(USER_KEY, JSON.stringify({ token, user }));
  return user;
}

export function getProfile(options: AuthRequest = {}): Promise<UserProfile> {
  return fetchWithAuth("/api/profile", options);
}

export async function updateProfile(updates: Partial<UserProfile>, options: AuthRequest = {}): Promise<UserProfile> {
  return fetchWithAuth("/api/profile", {
    ...options,
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function getProgress(options: AuthRequest = {}): Promise<LearningProgress[]> {
  return fetchWithAuth("/api/progress", options);
}

export async function updateProgress(moduleId: string, progress: number, completed?: boolean, quiz_score?: number): Promise<LearningProgress> {
  return fetchWithAuth(`/api/progress/modules/${moduleId}`, {
    method: "PATCH",
    body: JSON.stringify({ progress, completed, quiz_score }),
  });
}

export async function getProjects(options: AuthRequest = {}): Promise<CloudProject[]> {
  return fetchWithAuth("/api/projects", options);
}

export function saveProgress(progress: UserProgress, options: AuthRequest): Promise<{ xp: number; modules: LearningProgress[] }> {
  return fetchWithAuth("/api/progress", {
    ...options, method: "PUT", body: JSON.stringify(progress),
  });
}

export async function updateModuleProgress(
  moduleId: string,
  patch: Partial<{ progress: number; completed?: boolean; quiz_score?: number }>
): Promise<LearningProgress> {
  return fetchWithAuth(`/api/progress/modules/${moduleId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function createProject(name: string, circuit_json: Circuit, sdk: string = "Qiskit", options: AuthRequest = {}): Promise<CloudProject> {
  return fetchWithAuth("/api/projects", {
    ...options,
    method: "POST",
    body: JSON.stringify({ name, circuit_json, sdk }),
  });
}

export async function updateProject(id: string, updates: Partial<Pick<CloudProject, "name" | "circuit_json" | "sdk">>, options: AuthRequest = {}): Promise<CloudProject> {
  return fetchWithAuth(`/api/projects/${id}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteProject(id: string, options: AuthRequest = {}): Promise<void> {
  await fetchWithAuth(`/api/projects/${id}`, { ...options, method: "DELETE" });
}

export type Collaborator = {
  id: number;
  user_id: string;
  email: string;
  permission: "view" | "edit";
  created_at: string;
};

export async function addCollaborator(
  projectId: string,
  email: string,
  permission: "view" | "edit" = "edit",
  options: AuthRequest = {}
): Promise<Collaborator> {
  return fetchWithAuth(`/api/projects/${projectId}/collaborators`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ email, permission }),
  });
}

export async function getCollaborators(
  projectId: string,
  options: AuthRequest = {}
): Promise<Collaborator[]> {
  return fetchWithAuth(`/api/projects/${projectId}/collaborators`, options);
}

export async function removeCollaborator(
  projectId: string,
  collaboratorId: number,
  options: AuthRequest = {}
): Promise<void> {
  await fetchWithAuth(
    `/api/projects/${projectId}/collaborators/${collaboratorId}`,
    { ...options, method: "DELETE" }
  );
}
