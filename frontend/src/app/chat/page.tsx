"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { getLocalizedGreeting, getSpeechLang, getSpeechVoicePrefixes } from "@/lib/user";
import { Send, ChevronDown, Zap, Languages, Mic, MicOff, Paperclip, X, Volume2, Plus, Pencil, Trash2, History, VolumeX, BookMarked, Filter, FileText } from "lucide-react";

type Citation = {
  source: string;
  chapter: string;
  subject: string;
  class_level: string;
  chunk_index?: number | null;
  score?: number | null;
  snippet: string;
  source_text: string;
};

type Msg = {
  role: "user" | "ai";
  text: string;
  time: string;
  id: string;
  citations?: Citation[];
};

type ChatSessionSummary = {
  session_id: string;
  title: string;
  preview: string;
  created_at: string;
  updated_at: string;
};

type CatalogItem = {
  label: string;
  count: number;
};

type RagCatalog = {
  ready: boolean;
  classes: CatalogItem[];
  subjects: CatalogItem[];
  chapters: CatalogItem[];
  sources: CatalogItem[];
};

type RagFilters = {
  class_level: string;
  subject: string;
  chapter: string;
};

type ChatResponse = {
  response: string;
  citations?: Citation[];
  rag_used?: boolean;
  rag_filters?: Partial<RagFilters>;
  language?: string;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  speechSynthesis?: SpeechSynthesis;
};

const SIMPLIFY_LABELS = ["Simpler", "Even Simpler", "Like I'm 5"];
const CHAT_STORAGE_KEY = "sakhi_chat_session_id";
const AUTO_SPEAK_STORAGE_KEY = "sakhi_auto_speak";
const VOICE_STORAGE_KEY = "sakhi_voice_uri";

const EMPTY_FILTERS: RagFilters = {
  class_level: "",
  subject: "",
  chapter: "",
};

const ACTION_CARDS = [
  { title: "Ask a Doubt", desc: "Get a simple explanation of any concept", prompt: "I have a doubt I'd like to understand." },
  { title: "Take a Quiz", desc: "Test your understanding with 5 questions", prompt: "Give me a short quiz on my current topic." },
  { title: "Study Plan", desc: "Get a structured 20-minute session plan", prompt: "Create a 20-minute study plan for me today." },
  { title: "Translate", desc: "Rephrase the last concept in your selected language", prompt: "" },
];

function createSessionId() {
  return `session_${Date.now()}`;
}

function getStoredChatSessionId() {
  if (typeof window === "undefined") return createSessionId();
  const existing = localStorage.getItem(CHAT_STORAGE_KEY);
  if (existing) return existing;
  const created = createSessionId();
  localStorage.setItem(CHAT_STORAGE_KEY, created);
  return created;
}

function setStoredChatSessionId(sessionId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_STORAGE_KEY, sessionId);
}

function getStoredAutoSpeak() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(AUTO_SPEAK_STORAGE_KEY) !== "false";
}

function getStoredVoiceUri() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(VOICE_STORAGE_KEY) || "";
}

function getTimeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 10, alignSelf: "flex-start", maxWidth: "76%" }}>
      <div className="avatar avatar-ai" style={{ fontSize: 15 }}>S</div>
      <div className="bubble bubble-ai">
        <div className="typing-dots">
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function AiBubble({ text }: { text: string }) {
  return (
    <div className="bubble bubble-ai markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function toUiMessages(history: Array<{ role: string; content: string; citations?: Citation[] }>): Msg[] {
  return history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message, index) => ({
      role: message.role === "assistant" ? "ai" : "user",
      text: message.content,
      id: `${message.role}_${index}`,
      time: "",
      citations: message.role === "assistant" ? message.citations || [] : [],
    }));
}

function stripMarkdownForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactFilters(filters: RagFilters) {
  const next: Partial<RagFilters> = {};
  if (filters.class_level) next.class_level = filters.class_level;
  if (filters.subject) next.subject = filters.subject;
  if (filters.chapter) next.chapter = filters.chapter;
  return next;
}

export default function ChatPage() {
  const router = useRouter();
  const { user, isReady } = useUser();
  const [chatSessionId, setChatSessionId] = useState(() => getStoredChatSessionId());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [catalog, setCatalog] = useState<RagCatalog>({ ready: false, classes: [], subjects: [], chapters: [], sources: [] });
  const [ragFilters, setRagFilters] = useState<RagFilters>(EMPTY_FILTERS);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastAiId, setLastAiId] = useState<string | null>(null);
  const [simplifyLevel, setSimplifyLevel] = useState<Record<string, number>>({});
  const [showEmpty, setShowEmpty] = useState(true);
  const [listening, setListening] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => getStoredAutoSpeak());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState(() => getStoredVoiceUri());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messageCounterRef = useRef(0);

  const nextMessageId = (prefix: "u" | "a" | "e") => {
    messageCounterRef.current += 1;
    return `${prefix}${messageCounterRef.current}`;
  };

  async function refreshSessions(userId?: number) {
    if (!userId) return;
    try {
      const result = await api.listChatSessions(userId);
      setSessions(result.sessions || []);
    } catch {
      setSessions([]);
    }
  }

  async function loadCatalog() {
    try {
      const result = await api.getRagCatalog();
      setCatalog(result);
    } catch {
      setCatalog({ ready: false, classes: [], subjects: [], chapters: [], sources: [] });
    }
  }

  async function loadSession(sessionId: string, userId?: number) {
    if (!userId) return;
    setLoadingHistory(true);
    try {
      const history = await api.getChatHistory(sessionId);
      const nextMessages = toUiMessages(history.messages || []);
      setMessages(nextMessages);
      setShowEmpty(nextMessages.length === 0);
      const lastAi = [...nextMessages].reverse().find((message) => message.role === "ai");
      setLastAiId(lastAi?.id || null);
      setChatSessionId(sessionId);
      setStoredChatSessionId(sessionId);
    } catch {
      setMessages([]);
      setShowEmpty(true);
      setLastAiId(null);
      setChatSessionId(sessionId);
      setStoredChatSessionId(sessionId);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (isReady && !user) router.push("/onboard");
  }, [isReady, router, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (!user?.user_id) return;
    void (async () => {
      await Promise.all([refreshSessions(user.user_id), loadCatalog()]);
      await loadSession(chatSessionId, user.user_id);
    })();
  }, [chatSessionId, user?.user_id]);

  useEffect(() => {
    const w = window as SpeechWindow;
    const recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!recognition || !user) return;

    const instance = new recognition();
    instance.continuous = false;
    instance.interimResults = true;
    instance.lang = getSpeechLang(user.language);
    instance.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join("");
      setInput(transcript);
    };
    instance.onend = () => setListening(false);
    instance.onerror = () => setListening(false);
    recognitionRef.current = instance;
  }, [user]);

  useEffect(() => {
    const w = window as SpeechWindow;
    if (!w.speechSynthesis) return;

    const syncVoices = () => {
      const available = w.speechSynthesis?.getVoices() || [];
      setVoices(available);
      if (!available.some((voice) => voice.voiceURI === selectedVoiceUri)) {
        const preferred = available.find((voice) =>
          getSpeechVoicePrefixes(user?.language || "English").some((prefix) => voice.lang.startsWith(prefix))
        );
        if (preferred) {
          setSelectedVoiceUri(preferred.voiceURI);
          localStorage.setItem(VOICE_STORAGE_KEY, preferred.voiceURI);
        }
      }
    };

    syncVoices();
    w.speechSynthesis.onvoiceschanged = syncVoices;
    return () => {
      if (w.speechSynthesis) w.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceUri, user?.language]);

  const speakText = (text: string) => {
    const w = window as SpeechWindow;
    if (!w.speechSynthesis || !user) return;
    const cleaned = stripMarkdownForSpeech(text);
    if (!cleaned) return;
    w.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = getSpeechLang(user.language);
    const selected = voices.find((voice) => voice.voiceURI === selectedVoiceUri);
    const fallback = voices.find((voice) =>
      getSpeechVoicePrefixes(user.language).some((prefix) => voice.lang.startsWith(prefix))
    );
    utterance.voice = selected || fallback || null;
    w.speechSynthesis.speak(utterance);
  };

  const startNewSession = () => {
    const nextSessionId = createSessionId();
    setChatSessionId(nextSessionId);
    setStoredChatSessionId(nextSessionId);
    setMessages([]);
    setShowEmpty(true);
    setLastAiId(null);
    setSimplifyLevel({});
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const toggleVoice = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }
    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }
    recognition.start();
    setListening(true);
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const appendAiMessage = async (response: ChatResponse, simplify = false, level = 0) => {
    const aiMsg: Msg = {
      role: "ai",
      text: response.response,
      id: nextMessageId("a"),
      time: getTimeLabel(),
      citations: response.citations || [],
    };
    setMessages((current) => [...current, aiMsg]);
    setLastAiId(aiMsg.id);
    if (simplify) {
      setSimplifyLevel((prev) => ({ ...prev, [aiMsg.id]: level }));
    }
    if (user?.user_id) {
      await refreshSessions(user.user_id);
    }
    if (autoSpeak) speakText(aiMsg.text);
  };

  const sendMessage = async (text: string, simplify = false, level = 0) => {
    if (!text.trim() || !user || typing) return;
    setShowEmpty(false);
    if (!simplify) {
      setMessages((current) => [
        ...current,
        { role: "user", text: text.trim(), id: nextMessageId("u"), time: getTimeLabel() },
      ]);
    }
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setTyping(true);
    try {
      const response = await api.chat({
        session_id: chatSessionId,
        message: text.trim(),
        class_: user.class_,
        simplify,
        language: user.language,
        user_name: user.name,
        weak_subject: user.weak_subject,
        user_id: user.user_id,
        rag_filters: simplify ? undefined : compactFilters(ragFilters),
      });
      await appendAiMessage(response, simplify, level);
    } catch {
      const errorMsg: Msg = {
        role: "ai",
        id: nextMessageId("e"),
        text: "I'm having trouble connecting right now. Please make sure the backend is running on port 8000.",
        time: getTimeLabel(),
      };
      setMessages((current) => [...current, errorMsg]);
      setLastAiId(errorMsg.id);
    } finally {
      setTyping(false);
      textareaRef.current?.focus();
    }
  };

  const handleTranslate = async () => {
    if (!user || typing) return;
    setShowEmpty(false);
    setTyping(true);
    try {
      const response = await api.chat({
        session_id: chatSessionId,
        message: "",
        class_: user.class_,
        language: user.language,
        user_name: user.name,
        weak_subject: user.weak_subject,
        translate_to: user.language,
        user_id: user.user_id,
      });
      await appendAiMessage(response);
    } catch {
      const errorMsg: Msg = {
        role: "ai",
        id: nextMessageId("e"),
        text: "I'm having trouble translating that right now.",
        time: getTimeLabel(),
      };
      setMessages((current) => [...current, errorMsg]);
      setLastAiId(errorMsg.id);
    } finally {
      setTyping(false);
      textareaRef.current?.focus();
    }
  };

  const handleSimplify = (msgId: string) => {
    const last = messages.find((message) => message.id === msgId);
    if (!last) return;
    const currentLevel = simplifyLevel[msgId] ?? -1;
    const nextLevel = Math.min(currentLevel + 1, SIMPLIFY_LABELS.length - 1);
    void sendMessage(last.text, true, nextLevel);
  };

  const handleFileUpload = async () => {
    if (!uploadFile || !user) return;
    setUploading(true);
    setShowEmpty(false);
    setMessages((current) => [
      ...current,
      { role: "user", text: `Uploaded: **${uploadFile.name}**`, id: nextMessageId("u"), time: getTimeLabel() },
    ]);
    const fileToUpload = uploadFile;
    setUploadFile(null);
    setTyping(true);
    try {
      const data = await api.chatUpload(fileToUpload, user.class_, user.language, user.user_id);
      await appendAiMessage({ response: data.response || "Here's what I found in your document." });
    } catch {
      const errorMsg: Msg = {
        role: "ai",
        id: nextMessageId("e"),
        text: "I couldn't read the file right now. Try again or paste the text directly.",
        time: getTimeLabel(),
      };
      setMessages((current) => [...current, errorMsg]);
      setLastAiId(errorMsg.id);
    } finally {
      setTyping(false);
      setUploading(false);
    }
  };

  const renameSession = async (session: ChatSessionSummary) => {
    if (!user?.user_id) return;
    const nextTitle = window.prompt("Rename this chat", session.title);
    if (!nextTitle || !nextTitle.trim()) return;
    try {
      await api.renameChatSession(session.session_id, { user_id: user.user_id, title: nextTitle.trim() });
      await refreshSessions(user.user_id);
    } catch {
      alert("Could not rename the chat right now.");
    }
  };

  const deleteSession = async (session: ChatSessionSummary) => {
    if (!user?.user_id) return;
    if (!window.confirm(`Delete "${session.title}"?`)) return;
    try {
      await api.deleteChatSession(session.session_id, user.user_id);
      await refreshSessions(user.user_id);
      if (session.session_id === chatSessionId) startNewSession();
    } catch {
      alert("Could not delete the chat right now.");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const saveBookmark = async (message: Msg) => {
    if (!user || message.role !== "ai") return;
    try {
      await api.saveArtifact({
        user_id: user.user_id,
        artifact_type: "bookmark",
        title: message.text.slice(0, 60) || "Saved Sakhi answer",
        topic: ragFilters.chapter || ragFilters.subject || user.weak_subject,
        source_session_id: chatSessionId,
        payload: {
          text: message.text,
          citations: message.citations || [],
          saved_from: "chat",
        },
      });
      alert("Saved to your study library.");
    } catch {
      alert("Could not save this answer right now.");
    }
  };

  const filteredVoices = voices.filter((voice) =>
    getSpeechVoicePrefixes(user?.language || "English").some((prefix) => voice.lang.startsWith(prefix))
  );
  const visibleVoices = filteredVoices.length ? filteredVoices : voices;
  const filteredChapters = catalog.chapters.filter((chapter) => {
    if (!ragFilters.subject) return true;
    return chapter.label.toLowerCase().includes(ragFilters.subject.toLowerCase()) || true;
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 300, borderRight: "1px solid var(--border-subtle)", background: "#fafaf9", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <button className="btn btn-primary btn-full" onClick={startNewSession} style={{ justifyContent: "center" }}>
            <Plus size={15} /> New Chat
          </button>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Volume2 size={16} style={{ color: "var(--emerald)" }} />
              <strong style={{ fontSize: 13 }}>Voice Replies</strong>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(event) => {
                  const next = event.target.checked;
                  setAutoSpeak(next);
                  localStorage.setItem(AUTO_SPEAK_STORAGE_KEY, String(next));
                }}
              />
              Speak Sakhi&apos;s replies automatically
            </label>
            <select
              className="input input-select"
              value={selectedVoiceUri}
              onChange={(event) => {
                setSelectedVoiceUri(event.target.value);
                localStorage.setItem(VOICE_STORAGE_KEY, event.target.value);
              }}
              style={{ fontSize: 12, height: 36 }}
            >
              <option value="">Browser default voice</option>
              {visibleVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Filter size={16} style={{ color: "var(--emerald)" }} />
              <strong style={{ fontSize: 13 }}>NCERT Filters</strong>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px" }}>
              Narrow Sakhi&apos;s textbook retrieval to a class, subject, or chapter.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                className="input input-select"
                value={ragFilters.class_level}
                onChange={(event) => setRagFilters((current) => ({ ...current, class_level: event.target.value }))}
                style={{ fontSize: 12, height: 36 }}
              >
                <option value="">All classes</option>
                {catalog.classes.map((item) => (
                  <option key={item.label} value={item.label}>
                    Class {item.label} ({item.count})
                  </option>
                ))}
              </select>
              <select
                className="input input-select"
                value={ragFilters.subject}
                onChange={(event) => setRagFilters((current) => ({ ...current, subject: event.target.value, chapter: "" }))}
                style={{ fontSize: 12, height: 36 }}
              >
                <option value="">All subjects</option>
                {catalog.subjects.map((item) => (
                  <option key={item.label} value={item.label}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
              <select
                className="input input-select"
                value={ragFilters.chapter}
                onChange={(event) => setRagFilters((current) => ({ ...current, chapter: event.target.value }))}
                style={{ fontSize: 12, height: 36 }}
                disabled={!catalog.ready}
              >
                <option value="">All chapters</option>
                {filteredChapters.map((item) => (
                  <option key={item.label} value={item.label}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 10, justifyContent: "center" }}
              onClick={() => setRagFilters(EMPTY_FILTERS)}
            >
              Reset Filters
            </button>
          </div>

          <div className="card" style={{ padding: 16, flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <History size={16} style={{ color: "var(--emerald)" }} />
              <strong style={{ fontSize: 13 }}>Recent Chats</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 520px)", overflowY: "auto" }}>
              {sessions.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Your conversations will appear here.</p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.session_id}
                    onClick={() => void loadSession(session.session_id, user?.user_id)}
                    className="card"
                    style={{
                      textAlign: "left",
                      padding: 12,
                      border: session.session_id === chatSessionId ? "1px solid var(--emerald)" : "1px solid var(--border-subtle)",
                      background: session.session_id === chatSessionId ? "#f0fdf4" : "white",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {session.title}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {session.preview || "No reply yet"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            void renameSession(session);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void renameSession(session);
                            }
                          }}
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Pencil size={13} />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteSession(session);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void deleteSession(session);
                            }
                          }}
                          style={{ color: "#dc2626" }}
                        >
                          <Trash2 size={13} />
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <section style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
            <AnimatePresence>
              {showEmpty && messages.length === 0 && !typing && !loadingHistory ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ maxWidth: 640, margin: "60px auto 0", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                    <div className="sakhi-avatar-lg">S</div>
                  </div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 8 }}>
                    {user ? getLocalizedGreeting(user).split(".")[0] : "Welcome"}
                  </h1>
                  <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 20 }}>Patient explanations. Everyday progress.</p>
                  {catalog.ready && (
                    <div style={{ marginBottom: 26, padding: "12px 14px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Current NCERT scope</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Class: {ragFilters.class_level || "All"} · Subject: {ragFilters.subject || "All"} · Chapter: {ragFilters.chapter || "All"}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
                    {ACTION_CARDS.map((card, index) => (
                      <motion.button
                        key={card.title}
                        className="action-card"
                        onClick={() => card.title === "Translate" ? void handleTranslate() : void sendMessage(card.prompt)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 * index }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{card.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{card.desc}</div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
                  {loadingHistory && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading conversation...</p>}
                  {messages.map((msg) => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`bubble-wrap ${msg.role}`}>
                      <div className={`avatar ${msg.role === "ai" ? "avatar-ai" : "avatar-user"}`} style={{ fontSize: 15 }}>
                        {msg.role === "ai" ? "S" : "U"}
                      </div>
                      <div style={{ width: "100%" }}>
                        {msg.role === "ai" ? (
                          <AiBubble text={msg.text} />
                        ) : (
                          <div className="bubble bubble-user">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                          </div>
                        )}
                        {msg.role === "ai" && (msg.citations || []).length > 0 && (
                          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                            {(msg.citations || []).map((citation, index) => (
                              <div key={`${msg.id}_citation_${index}`} style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 14, padding: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                  <BookMarked size={13} style={{ color: "#2563eb" }} />
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{citation.source}</span>
                                  {citation.chapter && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{citation.chapter}</span>}
                                  {citation.class_level && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Class {citation.class_level}</span>}
                                  {citation.subject && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{citation.subject}</span>}
                                </div>
                                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.55 }}>{citation.snippet}</p>
                                <details>
                                  <summary style={{ fontSize: 12, color: "#2563eb", cursor: "pointer" }}>Show source text</summary>
                                  <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "white", border: "1px solid #e5e7eb", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                    {citation.source_text}
                                  </div>
                                </details>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                          <span className="bubble-time">{msg.time}</span>
                          {msg.role === "ai" && (
                            <button className="bubble-action-btn" onClick={() => speakText(msg.text)}>
                              <Volume2 size={11} /> Speak
                            </button>
                          )}
                          {msg.role === "ai" && (
                            <button className="bubble-action-btn" onClick={() => void saveBookmark(msg)}>
                              <BookMarked size={11} /> Save
                            </button>
                          )}
                          {msg.role === "ai" && msg.id === lastAiId && (
                            <>
                              <button className="bubble-action-btn" onClick={() => handleSimplify(msg.id)}>
                                <ChevronDown size={11} />
                                {SIMPLIFY_LABELS[Math.min((simplifyLevel[msg.id] ?? -1) + 1, SIMPLIFY_LABELS.length - 1)]}
                              </button>
                              <button className="bubble-action-btn" onClick={() => void sendMessage("Generate a short quiz based on what we just discussed.")}>
                                <Zap size={11} /> Quiz
                              </button>
                              <button className="bubble-action-btn" onClick={() => void handleTranslate()}>
                                <Languages size={11} /> Translate
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {typing && <TypingIndicator />}
                  <div ref={bottomRef} />
                </div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {uploadFile && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ padding: "8px 32px", background: "#f0fdf4", borderTop: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 10 }}
              >
                <Paperclip size={14} style={{ color: "var(--emerald)" }} />
                <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{uploadFile.name}</span>
                <button className="btn btn-primary btn-sm" onClick={handleFileUpload} disabled={uploading}>
                  {uploading ? "Analyzing..." : "Send to Sakhi"}
                </button>
                <button className="btn-icon" onClick={() => setUploadFile(null)} style={{ border: "none" }}>
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ padding: "12px 32px 20px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-app)" }}>
            <div style={{ maxWidth: 820, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12 }}>
                  <FileText size={13} />
                  Textbook citations are shown whenever Sakhi uses RAG context.
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Scope: Class {ragFilters.class_level || "All"} · {ragFilters.subject || "All subjects"} · {ragFilters.chapter || "All chapters"}
                </div>
              </div>

              <div className="chat-input-bar">
                <button className="chat-icon-btn" onClick={() => fileInputRef.current?.click()} title="Upload notes, PDF, or image">
                  <Paperclip size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setUploadFile(file);
                    event.target.value = "";
                  }}
                />

                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder={`Ask Sakhi anything${user?.class_ ? ` - Class ${user.class_}` : ""}...`}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    resizeTextarea();
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={typing}
                  style={{ paddingTop: 4 }}
                />

                <button className={`chat-icon-btn ${listening ? "chat-icon-btn--active" : ""}`} onClick={toggleVoice} title={listening ? "Stop listening" : "Voice input"}>
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                <button
                  className="chat-icon-btn"
                  onClick={() => {
                    const w = window as SpeechWindow;
                    w.speechSynthesis?.cancel();
                  }}
                  title="Stop speaking"
                >
                  <VolumeX size={16} />
                </button>

                <button className="chat-send-btn" onClick={() => void sendMessage(input)} disabled={!input.trim() || typing}>
                  <Send size={15} />
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
                AI Sakhi can make mistakes. For important topics, verify with your textbook and review the cited source text.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
