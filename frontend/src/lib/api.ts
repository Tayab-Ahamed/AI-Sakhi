// Centralized API client for AI Sakhi backend
// Includes: retry, timeout, JWT Bearer injection, typed helpers

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TIMEOUT_MS = 30_000; // 30 s
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("sakhi_auth");
    if (!raw) return null;
    const auth = JSON.parse(raw) as { token?: string };
    return auth.token || null;
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch(path: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(text || `API error ${res.status}`);
    }
    return res.json();
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const isNetworkError = err instanceof TypeError && err.message.includes("fetch");

    if (retries > 0 && (isAbort || isNetworkError)) {
      await sleep(RETRY_DELAY_MS);
      return apiFetch(path, options, retries - 1);
    }
    throw err;
  }
}

// Multipart helper (no Content-Type override — browser sets boundary automatically)
async function apiFormFetch(path: string, form: FormData): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      body: form,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(text || `API error ${res.status}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Type helpers ─────────────────────────────────────────────────────────────

type ChatParams = {
  session_id: string;
  message: string;
  class_: string;
  simplify?: boolean;
  language?: string;
  user_name?: string;
  weak_subject?: string;
  translate_to?: string;
  user_id?: number;
  rag_filters?: { class_level?: string; subject?: string; chapter?: string };
};

// ── Exported API object ───────────────────────────────────────────────────────

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  createUser: (data: { name: string; class_: string; language: string; weak_subject: string; role?: string; organization_id?: number }) =>
    apiFetch("/user/create", { method: "POST", body: JSON.stringify(data) }),

  getUser: (userId: number) => apiFetch(`/user/${userId}`),

  updateUser: (userId: number, data: { name: string; class_: string; language: string; weak_subject: string; role?: string; organization_id?: number }) =>
    apiFetch(`/user/${userId}`, { method: "PUT", body: JSON.stringify(data) }),

  issueToken: (data: { user_id: number; expires_in_hours?: number }) =>
    apiFetch("/auth/token", { method: "POST", body: JSON.stringify(data) }),

  verifyToken: (data: { token: string }) =>
    apiFetch("/auth/verify", { method: "POST", body: JSON.stringify(data) }),

  logout: (data: { token: string }) =>
    apiFetch("/auth/logout", { method: "POST", body: JSON.stringify(data) }),

  // ── Health ─────────────────────────────────────────────────────────────────
  getHealth: () => apiFetch("/health"),

  // ── Chat ───────────────────────────────────────────────────────────────────
  chat: (data: ChatParams) =>
    apiFetch("/chat", { method: "POST", body: JSON.stringify(data) }),

  clearChat: (sessionId: string) =>
    apiFetch(`/chat/clear?session_id=${encodeURIComponent(sessionId)}`, { method: "POST" }),

  getChatHistory: (sessionId: string) => apiFetch(`/chat/history/${sessionId}`),

  listChatSessions: (userId: number) => apiFetch(`/chat/sessions/${userId}`),

  renameChatSession: (sessionId: string, data: { user_id: number; title: string }) =>
    apiFetch(`/chat/session/${sessionId}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteChatSession: (sessionId: string, userId: number) =>
    apiFetch(`/chat/session/${sessionId}?user_id=${encodeURIComponent(String(userId))}`, { method: "DELETE" }),

  chatUpload: (file: File, class_: string, language: string, userId?: number) => {
    const form = new FormData();
    form.append("file", file);
    form.append("class_", class_);
    form.append("language", language);
    if (userId) form.append("user_id", String(userId));
    return apiFormFetch("/chat/upload", form);
  },

  // ── Quiz ───────────────────────────────────────────────────────────────────
  generateQuiz: (data: { topic: string; class_: string; language?: string; user_id?: number; difficulty?: string }) =>
    apiFetch("/quiz/generate", { method: "POST", body: JSON.stringify(data) }),

  evaluateAnswer: (data: { question: object; user_answer: string; language?: string; user_id?: number }) =>
    apiFetch("/quiz/evaluate", { method: "POST", body: JSON.stringify(data) }),

  // ── Study Plan ─────────────────────────────────────────────────────────────
  generateStudyPlan: (data: { topic: string; subject: string; class_: string; language?: string; user_id?: number }) =>
    apiFetch("/study-plan", { method: "POST", body: JSON.stringify(data) }),

  // ── Study Notes ────────────────────────────────────────────────────────────
  generateStudyNotes: (data: { topic: string; class_: string; language?: string; subject?: string; user_id?: number }) =>
    apiFetch("/study-notes/generate", { method: "POST", body: JSON.stringify(data) }),

  // ── Flashcards ─────────────────────────────────────────────────────────────
  generateFlashcards: (data: { topic: string; class_: string; language?: string; user_id?: number }) =>
    apiFetch("/flashcards/generate", { method: "POST", body: JSON.stringify(data) }),

  getDueFlashcards: (userId: number) => apiFetch(`/flashcards/due/${userId}`),

  saveFlashcardReview: (data: { user_id: number; topic: string; card_id: number; card_front: string; card_back: string }) =>
    apiFetch("/flashcards/review", { method: "POST", body: JSON.stringify(data) }),

  rateFlashcardReview: (reviewId: number, data: { user_id: number; quality: number }) =>
    apiFetch(`/flashcards/review/${reviewId}/rate`, { method: "POST", body: JSON.stringify(data) }),

  // ── Progress ───────────────────────────────────────────────────────────────
  updateProgress: (data: { user_id: number; topic: string; score: number; total: number }) =>
    apiFetch("/progress/update", { method: "POST", body: JSON.stringify(data) }),

  getProgress: (userId: number) => apiFetch(`/progress/${userId}`),

  // ── Artifacts ──────────────────────────────────────────────────────────────
  saveArtifact: (data: { user_id: number; artifact_type: string; title: string; topic?: string; source_session_id?: string; payload: object }) =>
    apiFetch("/artifacts", { method: "POST", body: JSON.stringify(data) }),

  listArtifacts: (userId: number, artifactType?: string) =>
    apiFetch(`/artifacts/${userId}${artifactType ? `?artifact_type=${encodeURIComponent(artifactType)}` : ""}`),

  deleteArtifact: (artifactId: number, userId: number) =>
    apiFetch(`/artifacts/${artifactId}?user_id=${encodeURIComponent(String(userId))}`, { method: "DELETE" }),

  updateArtifact: (artifactId: number, data: { user_id: number; title?: string; topic?: string; payload?: object }) =>
    apiFetch(`/artifacts/${artifactId}`, { method: "PATCH", body: JSON.stringify(data) }),

  // ── Reports ────────────────────────────────────────────────────────────────
  getUserReport: (userId: number) => apiFetch(`/reports/user/${userId}`),
  getStudentReportData: (userId: number) => apiFetch(`/report/student/${userId}`),

  // ── RAG ────────────────────────────────────────────────────────────────────
  getRagStats: () => apiFetch("/rag/stats"),
  getRagCatalog: () => apiFetch("/rag/catalog"),

  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard: (organizationId?: number) =>
    apiFetch(`/dashboard${organizationId ? `?organization_id=${organizationId}` : ""}`),

  // ── Demo ───────────────────────────────────────────────────────────────────
  seedDemoData: () => apiFetch("/demo/seed", { method: "POST", body: JSON.stringify({}) }),

  // ── Adaptive / Recommendations ────────────────────────────────────────────
  getRecommendedDifficulty: (userId: number, topic?: string) =>
    apiFetch(`/quiz/recommended-difficulty/${userId}${topic ? `?topic=${encodeURIComponent(topic)}` : ""}`),

  getRecommendations: (userId: number) => apiFetch(`/recommendations/${userId}`),

  // ── Teacher Tools ─────────────────────────────────────────────────────────
  createAssignment: (data: { teacher_id: number; organization_id: number; title: string; subject: string; topic: string; difficulty?: string; class_: string; instructions?: string; due_date?: string | null }) =>
    apiFetch("/assignments", { method: "POST", body: JSON.stringify(data) }),

  listAssignments: (params: { organization_id?: number; teacher_id?: number; class_?: string }) => {
    const q = new URLSearchParams();
    if (params.organization_id) q.set("organization_id", String(params.organization_id));
    if (params.teacher_id) q.set("teacher_id", String(params.teacher_id));
    if (params.class_) q.set("class_", params.class_);
    return apiFetch(`/assignments?${q.toString()}`);
  },

  getAssignment: (id: number) => apiFetch(`/assignments/${id}`),

  deleteAssignment: (id: number, teacherId: number) =>
    apiFetch(`/assignments/${id}?teacher_id=${teacherId}`, { method: "DELETE" }),

  submitAssignment: (assignmentId: number, data: { student_id: number; score: number; total_questions: number }) =>
    apiFetch(`/assignments/${assignmentId}/submit`, { method: "POST", body: JSON.stringify(data) }),

  getStudentAssignments: (userId: number, organizationId?: number) =>
    apiFetch(`/assignments/student/${userId}${organizationId ? `?organization_id=${organizationId}` : ""}`),

  getAssignmentSubmissions: (assignmentId: number) =>
    apiFetch(`/assignments/${assignmentId}/submissions`),
};
