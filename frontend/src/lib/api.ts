// Centralized API client for AI Sakhi backend
// Includes: read-only retry, timeout, cookie sessions and CSRF, typed helpers
import type { PracticeAttempt, PracticeIntent, PracticeTopics } from "@/lib/practice";
import type { DiagnosticAnswers, DiagnosticAttempt, DiagnosticBlueprint, DiagnosticCandidates, DiagnosticCreate, DiagnosticList, DiagnosticPage, DiagnosticPublish, DiagnosticSave, DiagnosticStart, DiagnosticVersion } from "@/lib/diagnostics";

export const BASE_URL = "/api/backend";
const TIMEOUT_MS = 30_000; // 30 s
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

// Double-submit CSRF: the backend sets a readable cookie, we echo it in a header.
let csrfRequest: Promise<void> | null = null;
export async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie("sakhi_csrf");
  if (existing) return existing;
  try {
    if (!csrfRequest) {
      csrfRequest = fetch(`${BASE_URL}/auth/csrf`, { credentials: "include", cache: "no-store" })
        .then((response) => { if (!response.ok) throw new Error("Unable to initialize session protection"); })
        .finally(() => { csrfRequest = null; });
    }
    await csrfRequest;
  } catch {
    return null;
  }
  return readCookie("sakhi_csrf");
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

function authHeaders(base?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(base || {}) };
  const csrf = readCookie("sakhi_csrf");
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return headers;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch<T = Record<string, unknown>>(path: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    await ensureCsrfToken();
  }
  const headers = authHeaders(options.headers as Record<string, string> | undefined);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      if (retries > 0 && method === "GET" && [502, 503, 504].includes(res.status)) {
        await sleep(RETRY_DELAY_MS);
        return apiFetch<T>(path, options, retries - 1);
      }
      let detail = `API error ${res.status}`;
      const text = await res.text().catch(() => "");
      if (text) {
        try {
          detail = (JSON.parse(text) as { detail?: string }).detail || text;
        } catch {
          detail = text;
        }
      }
      throw new ApiError(detail, res.status);
    }
    return res.json();
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const isNetworkError = err instanceof TypeError && err.message.includes("fetch");

    if (retries > 0 && method === "GET" && (isAbort || isNetworkError)) {
      await sleep(RETRY_DELAY_MS);
      return apiFetch<T>(path, options, retries - 1);
    }
    throw err;
  }
}

// Multipart helper (no Content-Type override — browser sets boundary automatically)
async function apiFormFetch(path: string, form: FormData): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  await ensureCsrfToken();
  const headers: Record<string, string> = {};
  const csrf = readCookie("sakhi_csrf");
  if (csrf) headers["X-CSRF-Token"] = csrf;

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
  listDiagnosticBlueprints: (page: DiagnosticPage = {}) => apiFetch<DiagnosticList>(`/v2/diagnostics/blueprints?${new URLSearchParams(Object.entries(page).map(([key, value]) => [key, String(value)]))}`),
  createDiagnosticBlueprint: (input: DiagnosticCreate) => apiFetch<DiagnosticBlueprint>("/v2/diagnostics/blueprints", { method: "POST", body: JSON.stringify(input) }),
  getDiagnosticBlueprint: (id: number) => apiFetch<DiagnosticBlueprint>(`/v2/diagnostics/blueprints/${id}`),
  saveDiagnosticBlueprint: (id: number, input: DiagnosticSave) => apiFetch<DiagnosticBlueprint>(`/v2/diagnostics/blueprints/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  getDiagnosticCandidates: (id: number, page: DiagnosticPage = {}) => apiFetch<DiagnosticCandidates>(`/v2/diagnostics/blueprints/${id}/questions?${new URLSearchParams(Object.entries(page).map(([key, value]) => [key, String(value)]))}`),
  publishDiagnosticBlueprint: (id: number, input: DiagnosticPublish) => apiFetch<DiagnosticVersion>(`/v2/diagnostics/blueprints/${id}/publish`, { method: "POST", body: JSON.stringify(input) }),
  withdrawDiagnosticVersion: (id: number) => apiFetch<DiagnosticVersion>(`/v2/diagnostics/versions/${id}/withdraw`, { method: "POST", body: "{}" }),
  startDiagnostic: (input: DiagnosticStart) => apiFetch<DiagnosticAttempt>("/v2/diagnostics/attempts", { method: "POST", body: JSON.stringify(input) }),
  getDiagnosticAttempt: (id: string) => apiFetch<DiagnosticAttempt>(`/v2/diagnostics/attempts/${encodeURIComponent(id)}`),
  submitDiagnostic: (id: string, answers: DiagnosticAnswers) => apiFetch<DiagnosticAttempt>(`/v2/diagnostics/attempts/${encodeURIComponent(id)}/submission`, { method: "POST", body: JSON.stringify({ answers }) }),
  getPracticeTopics: () => apiFetch<PracticeTopics>("/v2/practice/topics"),
  startPractice: (intent: PracticeIntent) => apiFetch<PracticeAttempt>("/v2/practice/attempts", { method: "POST", body: JSON.stringify(intent) }),
  getPracticeAttempt: (id: string) => apiFetch<PracticeAttempt>(`/v2/practice/attempts/${encodeURIComponent(id)}`),
  submitPractice: (id: string, answers: Record<string, number>) => apiFetch<PracticeAttempt>(`/v2/practice/attempts/${encodeURIComponent(id)}/submission`, { method: "POST", body: JSON.stringify({ answers }) }),
  getSession: () => apiFetch("/auth/session"),
  getSessions: () => apiFetch("/auth/sessions"),
  revokeSession: (id: string) => apiFetch(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getPrivacyRequests: () => apiFetch("/v2/privacy/requests"),
  fulfilPrivacyRequest: (id: number) => apiFetch(`/v2/privacy/requests/${id}/fulfil`, { method: "POST", body: "{}" }),
  getSafetyEvents: () => apiFetch("/v2/safety/events"),
  acknowledgeSafetyEvent: (id: number) => apiFetch(`/v2/safety/events/${id}/acknowledge`, { method: "POST", body: "{}" }),
  changeUserRole: (userId: number, role: string) => apiFetch(`/users/${userId}`, { method: "PUT", body: JSON.stringify({ role }) }),
  // ── Auth ──────────────────────────────────────────────────────────────────
  createUser: (data: { name: string; class_: string; language: string; weak_subject: string; role?: string; organization_id?: number; password?: string }) =>
    apiFetch("/user/create", { method: "POST", body: JSON.stringify(data) }),

  getUser: (userId: number) => apiFetch(`/user/${userId}`),

  listUsers: (organizationId?: number) => apiFetch(`/users${organizationId ? `?organization_id=${organizationId}` : ""}`),

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

  evaluateQuizBatch: (data: {
    user_id: number;
    topic: string;
    items: Array<{ question: object; user_answer: string; language?: string }>;
  }) => apiFetch("/quiz/evaluate-batch", { method: "POST", body: JSON.stringify(data) }),

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
  seedDemoData: (data: { role: string; name: string; class_: string; language: string; weak_subject: string; organization_id: number }) => 
    apiFetch("/demo/seed", { method: "POST", body: JSON.stringify(data) }),

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

  getAssignment: (id: number) => apiFetch(`/assignments/detail/${id}`),

  deleteAssignment: (id: number, teacherId: number) =>
    apiFetch(`/assignments/${id}?teacher_id=${teacherId}`, { method: "DELETE" }),

  submitAssignment: (assignmentId: number, data: { student_id: number; score: number; total_questions: number }) =>
    apiFetch(`/assignments/${assignmentId}/submit`, { method: "POST", body: JSON.stringify(data) }),

  getStudentAssignments: (userId: number, organizationId?: number) =>
    apiFetch(`/assignments/student/${userId}${organizationId ? `?organization_id=${organizationId}` : ""}`),

  getAssignmentSubmissions: (assignmentId: number) =>
    apiFetch(`/assignments/${assignmentId}/submissions`),

  // ── Auth: Password Login ──────────────────────────────────────────────────
  login: (data: { name: string; password: string }) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  // ── Practice Paper ────────────────────────────────────────────────────────
  generatePracticePaper: (data: { topic: string; class_: string; subject?: string; language?: string; num_questions?: number; user_id?: number }) =>
    apiFetch("/practice-paper/generate", { method: "POST", body: JSON.stringify(data) }),

  // ── Gamification / XP ─────────────────────────────────────────────────────
  getUserXP: (userId: number) => apiFetch(`/gamification/xp/${userId}`),

  // ── Analytics ─────────────────────────────────────────────────────────────
  getTopicMastery: (userId: number) => apiFetch(`/analytics/mastery/${userId}`),
  logSessionEnd: (data: { user_id: number; module: string; duration_seconds: number }) =>
    apiFetch("/analytics/session-end", { method: "POST", body: JSON.stringify(data) }),
  getStudyTime: (userId: number) => apiFetch(`/analytics/study-time/${userId}`),
  getDailyActivity: (orgId: number) => apiFetch(`/analytics/daily-activity/${orgId}`),

  // ── Notifications ─────────────────────────────────────────────────────────
  getNotifications: (userId: number) => apiFetch(`/notifications/${userId}`),

  // ── Teacher Analytics, Roster & Feedback ──────────────────────────────────
  getClassAnalytics: (orgId: number) => apiFetch(`/analytics/class/${orgId}`),
  getOrganizationRoster: (orgId: number) => apiFetch(`/organization/roster/${orgId}`),
  updateSubmissionFeedback: (submissionId: number, feedbackNote: string) =>
    apiFetch(`/assignments/submissions/${submissionId}/feedback`, {
      method: "PUT",
      body: JSON.stringify({ feedback_note: feedbackNote }),
    }),
  updateAssignment: (assignmentId: number, data: { title: string; subject: string; topic: string; difficulty: string; instructions?: string; due_date?: string }) =>
    apiFetch(`/assignments/${assignmentId}`, { method: "PUT", body: JSON.stringify(data) }),
  getFeedbackSuggestions: (data: { topic: string; score: number; total: number; student_id?: number; language?: string }) =>
    apiFetch("/ai/feedback-suggestion", { method: "POST", body: JSON.stringify(data) }),

  // ── Leaderboard ────────────────────────────────────────────────────────────
  getLeaderboard: (orgId: number) => apiFetch(`/leaderboard/${orgId}`),

  // ── User Management ────────────────────────────────────────────────────────
  deactivateUser: (userId: number) => apiFetch(`/users/${userId}`, { method: "DELETE" }),

  // ── Parent Tools ───────────────────────────────────────────────────────────
  getChildren: (parentId: number) => apiFetch(`/parent/children/${parentId}`),
  linkChild: (parentId: number, childId: number) =>
    apiFetch("/parent/link-child", { method: "POST", body: JSON.stringify({ parent_id: parentId, child_id: childId }) }),

  // ── Organization ───────────────────────────────────────────────────────────
  joinOrg: (userId: number, joinCode: string) =>
    apiFetch("/organizations/join", { method: "POST", body: JSON.stringify({ user_id: userId, join_code: joinCode }) }),
  generateJoinCode: (orgId: number) =>
    apiFetch(`/organizations/${orgId}/generate-code`, { method: "POST" }),

  // ── Learning Goals ────────────────────────────────────────────────────────
  getGoals: (userId: number) => apiFetch(`/goals/${userId}`),
  createGoal: (data: { user_id: number; title: string; target_minutes: number; target_date?: string }) =>
    apiFetch("/goals", { method: "POST", body: JSON.stringify(data) }),
  checkinGoal: (goalId: number, data: { user_id: number; minutes: number; note?: string }) =>
    apiFetch(`/goals/${goalId}/checkin`, { method: "POST", body: JSON.stringify(data) }),
  deleteGoal: (goalId: number, userId: number) =>
    apiFetch(`/goals/${goalId}?user_id=${encodeURIComponent(String(userId))}`, { method: "DELETE" }),

  // ── Adaptive Learning ─────────────────────────────────────────────────────
  getSmartSprint: (userId: number, minutes = 25) =>
    apiFetch(`/v2/sprint/${userId}?minutes=${minutes}`),
  getMastery: (userId: number) => apiFetch(`/v2/mastery/${userId}`),
  getMisconceptions: (userId: number) => apiFetch(`/v2/misconceptions/${userId}`),
  recordMisconception: (data: { user_id: number; topic: string; question: string; answer: string; expected: string; explanation?: string }) =>
    apiFetch("/v2/misconceptions", { method: "POST", body: JSON.stringify(data) }),

  // ── Teacher Question Bank ─────────────────────────────────────────────────
  getQuestions: (status?: string, subject?: string) =>
    apiFetch(`/v2/questions?${new URLSearchParams({ ...(status ? { status } : {}), ...(subject ? { subject } : {}) })}`),
  createQuestion: (data: Record<string, unknown>) =>
    apiFetch("/v2/questions", { method: "POST", body: JSON.stringify(data) }),
  reviewQuestion: (questionId: number, status: "approved" | "rejected" | "draft", note = "") =>
    apiFetch(`/v2/questions/${questionId}/review`, { method: "PUT", body: JSON.stringify({ status, note }) }),

  // ── Privacy, Guardians and Safety ─────────────────────────────────────────
  getAiApproval: (userId: number) => apiFetch(`/v2/privacy/approvals/${userId}`),
  decideAiApproval: (userId: number, granted: boolean, policyVersion: string) =>
    apiFetch(`/v2/privacy/approvals/${userId}`, { method: "POST", body: JSON.stringify({ granted, policy_version: policyVersion }) }),
  exportMyData: (userId: number) => apiFetch(`/v2/privacy/export/${userId}`),
  requestPrivacyAction: (userId: number, requestType: "export" | "delete_account" | "delete_chat_history" | "restrict_processing") =>
    apiFetch("/v2/privacy/requests", { method: "POST", body: JSON.stringify({ user_id: userId, request_type: requestType }) }),
  getGuardianDigest: (childId: number) => apiFetch(`/v2/guardian/digest/${childId}`),
  reportSafetyEvent: (data: { user_id?: number; category: string; severity: string; minimal_context?: string }) =>
    apiFetch("/v2/safety/events", { method: "POST", body: JSON.stringify(data) }),

  // ── Quality Feedback ──────────────────────────────────────────────────────
  rateAnswer: (data: { user_id: number; session_id: string; rating: number; reason?: string }) =>
    apiFetch("/feedback/answer", { method: "POST", body: JSON.stringify(data) }),
};

export type Citation = {
  index?: number;
  label?: string;
  source?: string;
  page?: number | null;
  chapter?: string | null;
  subject?: string | null;
  class_level?: string | null;
  board?: string | null;
  score?: number;
  snippet?: string;
  source_text?: string;
};

type StreamEvent = {
  type: "token" | "citations" | "safety" | "error" | "done";
  text?: string;
  message?: string;
  citations?: Citation[];
  safety?: { severity?: string; categories?: string[]; blocked?: boolean };
  grounded?: boolean;
};

// ── Streaming Chat via SSE ────────────────────────────────────────────────────

export async function streamChat(
  data: {
    session_id: string;
    message: string;
    class_: string;
    language?: string;
    user_name?: string;
    weak_subject?: string;
    user_id?: number;
    organization_id?: number;
  },
  onChunk: (chunk: string) => void,
  onDone: (fullText: string) => void,
  onError?: (err: string) => void,
  onCitations?: (citations: Citation[]) => void
): Promise<void> {
  await ensureCsrfToken();
  const headers = authHeaders();

  try {
    const res = await fetch(`${BASE_URL}/chat/stream`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!res.ok || !res.body) {
      onError?.(`HTTP ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const content = line.slice(6);
        if (content === "[DONE]") {
          onDone(fullText);
          return;
        }
        // Frames are JSON, so tokens containing newlines cannot break the stream.
        let event: StreamEvent;
        try {
          event = JSON.parse(content) as StreamEvent;
        } catch {
          fullText += content;
          onChunk(content);
          continue;
        }
        if (event.type === "token" && event.text) {
          fullText += event.text;
          onChunk(event.text);
        } else if (event.type === "citations" && event.citations) {
          onCitations?.(event.citations);
        } else if (event.type === "error") {
          onError?.(event.message || "Stream error");
          return;
        }
      }
    }
    onDone(fullText);
  } catch (err: unknown) {
    onError?.(err instanceof Error ? err.message : "Stream error");
  }
}
