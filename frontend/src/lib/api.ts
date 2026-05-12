// Centralized API client for AI Sakhi backend
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  createUser: (data: { name: string; class_: string; language: string; weak_subject: string; role?: string; organization_id?: number }) =>
    apiFetch("/user/create", { method: "POST", body: JSON.stringify(data) }),

  getUser: (userId: number) => apiFetch(`/user/${userId}`),

  updateUser: (userId: number, data: { name: string; class_: string; language: string; weak_subject: string; role?: string; organization_id?: number }) =>
    apiFetch(`/user/${userId}`, { method: "PUT", body: JSON.stringify(data) }),

  issueToken: (data: { user_id: number; expires_in_hours?: number }) =>
    apiFetch("/auth/token", { method: "POST", body: JSON.stringify(data) }),

  verifyToken: (data: { token: string }) =>
    apiFetch("/auth/verify", { method: "POST", body: JSON.stringify(data) }),

  chat: (data: {
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
  }) =>
    apiFetch("/chat", { method: "POST", body: JSON.stringify(data) }),

  clearChat: (sessionId: string) =>
    apiFetch(`/chat/clear?session_id=${encodeURIComponent(sessionId)}`, { method: "POST" }),

  generateQuiz: (data: { topic: string; class_: string; language?: string; user_id?: number; difficulty?: string }) =>
    apiFetch("/quiz/generate", { method: "POST", body: JSON.stringify(data) }),

  evaluateAnswer: (data: { question: object; user_answer: string; language?: string; user_id?: number }) =>
    apiFetch("/quiz/evaluate", { method: "POST", body: JSON.stringify(data) }),

  generateStudyPlan: (data: { topic: string; subject: string; class_: string; language?: string; user_id?: number }) =>
    apiFetch("/study-plan", { method: "POST", body: JSON.stringify(data) }),

  generateFlashcards: (data: { topic: string; class_: string; language?: string; user_id?: number }) =>
    apiFetch("/flashcards/generate", { method: "POST", body: JSON.stringify(data) }),

  updateProgress: (data: { user_id: number; topic: string; score: number; total: number }) =>
    apiFetch("/progress/update", { method: "POST", body: JSON.stringify(data) }),

  getProgress: (userId: number) => apiFetch(`/progress/${userId}`),
  getChatHistory: (sessionId: string) => apiFetch(`/chat/history/${sessionId}`),
  listChatSessions: (userId: number) => apiFetch(`/chat/sessions/${userId}`),
  renameChatSession: (sessionId: string, data: { user_id: number; title: string }) =>
    apiFetch(`/chat/session/${sessionId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteChatSession: (sessionId: string, userId: number) =>
    apiFetch(`/chat/session/${sessionId}?user_id=${encodeURIComponent(String(userId))}`, { method: "DELETE" }),
  saveArtifact: (data: {
    user_id: number;
    artifact_type: string;
    title: string;
    topic?: string;
    source_session_id?: string;
    payload: object;
  }) => apiFetch("/artifacts", { method: "POST", body: JSON.stringify(data) }),
  listArtifacts: (userId: number, artifactType?: string) =>
    apiFetch(`/artifacts/${userId}${artifactType ? `?artifact_type=${encodeURIComponent(artifactType)}` : ""}`),
  deleteArtifact: (artifactId: number, userId: number) =>
    apiFetch(`/artifacts/${artifactId}?user_id=${encodeURIComponent(String(userId))}`, { method: "DELETE" }),
  updateArtifact: (artifactId: number, data: { user_id: number; title?: string; topic?: string; payload?: object }) =>
    apiFetch(`/artifacts/${artifactId}`, { method: "PATCH", body: JSON.stringify(data) }),
  getUserReport: (userId: number) => apiFetch(`/reports/user/${userId}`),

  getRagStats: () => apiFetch("/rag/stats"),
  getRagCatalog: () => apiFetch("/rag/catalog"),

  getHealth: () => apiFetch("/health"),

  getDashboard: (organizationId?: number) => apiFetch(`/dashboard${organizationId ? `?organization_id=${organizationId}` : ""}`),

  seedDemoData: () => apiFetch("/demo/seed", { method: "POST", body: JSON.stringify({}) }),

  chatUpload: (file: File, class_: string, language: string, userId?: number) => {
    const form = new FormData();
    form.append("file", file);
    form.append("class_", class_);
    form.append("language", language);
    if (userId) form.append("user_id", String(userId));
    return fetch(`${BASE_URL}/chat/upload`, { method: "POST", body: form }).then(async (r) => {
      if (!r.ok) {
        const err = await r.text();
        throw new Error(err || `API error ${r.status}`);
      }
      return r.json();
    });
  },

  // ── Phase 8: Personalized AI Tutor ───────────────────────────────────
  getRecommendedDifficulty: (userId: number, topic?: string) =>
    apiFetch(`/quiz/recommended-difficulty/${userId}${topic ? `?topic=${encodeURIComponent(topic)}` : ""}`),

  getRecommendations: (userId: number) =>
    apiFetch(`/recommendations/${userId}`),

  getDueFlashcards: (userId: number) =>
    apiFetch(`/flashcards/due/${userId}`),

  saveFlashcardReview: (data: {
    user_id: number;
    topic: string;
    card_id: number;
    card_front: string;
    card_back: string;
  }) => apiFetch("/flashcards/review", { method: "POST", body: JSON.stringify(data) }),

  rateFlashcardReview: (reviewId: number, data: { user_id: number; quality: number }) =>
    apiFetch(`/flashcards/review/${reviewId}/rate`, { method: "POST", body: JSON.stringify(data) }),

  // ── Phase 10: Teacher Tools ───────────────────────────────────────────
  createAssignment: (data: {
    teacher_id: number;
    organization_id: number;
    title: string;
    subject: string;
    topic: string;
    difficulty?: string;
    class_: string;
    instructions?: string;
    due_date?: string | null;
  }) => apiFetch("/assignments", { method: "POST", body: JSON.stringify(data) }),

  listAssignments: (params: { organization_id?: number; teacher_id?: number; class_?: string }) => {
    const q = new URLSearchParams();
    if (params.organization_id) q.set("organization_id", String(params.organization_id));
    if (params.teacher_id)      q.set("teacher_id",      String(params.teacher_id));
    if (params.class_)          q.set("class_",          params.class_);
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

  getStudentReportData: (userId: number) =>
    apiFetch(`/report/student/${userId}`),
};
