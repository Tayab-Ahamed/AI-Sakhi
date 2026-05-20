"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { getSubjectsForClass, getTopicsForSubjectAndClass } from "@/lib/curriculum";
import { useUser } from "@/lib/user-context";
import { Layers3, RotateCcw, ChevronLeft, ChevronRight, Save, Brain, CalendarClock, RefreshCw, CheckCircle2, Shuffle, AlertCircle, BookOpen, Trash2 } from "lucide-react";

type Flashcard = {
  id: number;
  front: string;
  back: string;
  hint: string;
};

type ReviewEntry = {
  mastery: number;
  interval_days: number;
  due_at: string;
  review_count: number;
  last_reviewed_at?: string;
};

type FlashcardDeck = {
  topic: string;
  class: string;
  language: string;
  cards: Flashcard[];
  review_state?: Record<string, ReviewEntry>;
};

type SavedArtifact = {
  id: number;
  title: string;
  topic?: string;
  payload: Record<string, unknown>;
};

function todayIsoDate() {
  return new Date().toISOString();
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function toDeck(payload: Record<string, unknown>) {
  return payload as unknown as FlashcardDeck;
}

export default function FlashcardsPage() {
  const { user } = useUser();
  const [subjects] = useState(() => (user ? getSubjectsForClass(user.class_) : []));
  const [selectedSub, setSelectedSub] = useState(() => subjects[0]?.id || "");
  const [topics, setTopics] = useState<string[]>(() => (
    user && subjects[0] ? getTopicsForSubjectAndClass(subjects[0].id, user.class_) : []
  ));
  const [topic, setTopic] = useState(() => user?.weak_subject || "");
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [savedDecks, setSavedDecks] = useState<SavedArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [activeArtifactId, setActiveArtifactId] = useState<number | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  // Phase 8: server-side SM-2 review schedule
  const [dueStats, setDueStats] = useState<{ total_cards: number; due_now: number } | null>(null);
  const [serverReviewMap, setServerReviewMap] = useState<Record<number, number>>({}); // card_id -> review_id
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");

  const loadSavedDecks = async (userId?: number) => {
    if (!userId) return;
    try {
      const result = await api.listArtifacts(userId, "flashcard_set") as { artifacts?: SavedArtifact[] };
      setSavedDecks(result.artifacts || []);
    } catch {
      setSavedDecks([]);
    }
  };

  useEffect(() => {
    if (!user?.user_id) return;
    let ignore = false;
    (api.listArtifacts(user.user_id, "flashcard_set") as Promise<{ artifacts?: SavedArtifact[] }>)
      .then((result) => {
        if (!ignore) setSavedDecks(result.artifacts || []);
      })
      .catch(() => {
        if (!ignore) setSavedDecks([]);
      });
    // Also load due cards count from server
    (api.getDueFlashcards(user.user_id) as Promise<{ stats: { total_cards: number; due_now: number } }>)
      .then((res) => {
        if (!ignore) setDueStats(res.stats);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [user?.user_id]);

  const onSubjectChange = (sid: string) => {
    setSelectedSub(sid);
    if (user) setTopics(getTopicsForSubjectAndClass(sid, user.class_));
    setTopic("");
  };

  const generate = async () => {
    if (!user || !topic.trim()) return;
    setLoading(true);
    setGenError(null);
    setServerReviewMap({});
    setScheduleMsg("");
    try {
      // Backend returns the deck object directly (unwrapped from the success/flashcards wrapper)
      const result = await api.generateFlashcards({
        topic: topic.trim(),
        class_: user.class_,
        language: user.language,
        user_id: user.user_id,
      }) as FlashcardDeck & { review_state?: Record<string, ReviewEntry> };
      setDeck({ ...result, review_state: result.review_state || {} });
      setCurrentCard(0);
      setFlipped(false);
      setActiveArtifactId(null);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Could not generate flashcards. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const shuffleDeck = () => {
    if (!deck) return;
    const shuffled = [...deck.cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDeck({ ...deck, cards: shuffled });
    setCurrentCard(0);
    setFlipped(false);
  };

  const saveDeck = async () => {
    if (!user || !deck) return;
    try {
      const saved = await api.saveArtifact({
        user_id: user.user_id,
        artifact_type: "flashcard_set",
        title: `${deck.topic} flashcards`,
        topic: deck.topic,
        payload: deck as unknown as object,
      }) as { id: number };
      setActiveArtifactId(saved.id);
      await loadSavedDecks(user.user_id);
    } catch {
      setGenError("Could not save this flashcard set right now.");
    }
  };

  const persistDeck = async (nextDeck: FlashcardDeck) => {
    if (!user?.user_id || !activeArtifactId) return;
    setSavingReview(true);
    try {
      await api.updateArtifact(activeArtifactId, {
        user_id: user.user_id,
        topic: nextDeck.topic,
        payload: nextDeck as unknown as object,
      });
      await loadSavedDecks(user.user_id);
    } finally {
      setSavingReview(false);
    }
  };

  // Phase 8: save all cards in the current deck to the SM-2 review schedule
  const saveToReviewSchedule = async () => {
    if (!user?.user_id || !deck) return;
    setSavingSchedule(true);
    setScheduleMsg("");
    try {
      const newMap: Record<number, number> = { ...serverReviewMap };
      let saved = 0;
      for (const c of deck.cards) {
        if (newMap[c.id]) continue;  // already saved
        const rev = await api.saveFlashcardReview({
          user_id: user.user_id,
          topic: deck.topic,
          card_id: c.id,
          card_front: c.front,
          card_back: c.back,
        }) as { id: number };
        newMap[c.id] = rev.id;
        saved++;
      }
      setServerReviewMap(newMap);
      // Refresh due stats
      const dueRes = await api.getDueFlashcards(user.user_id) as { stats: { total_cards: number; due_now: number } };
      setDueStats(dueRes.stats);
      setScheduleMsg(saved > 0 ? `${saved} card${saved !== 1 ? "s" : ""} added to your review schedule! 🗓️` : "All cards are already in your schedule.");
    } catch {
      setScheduleMsg("Could not save to review schedule right now.");
    } finally {
      setSavingSchedule(false);
    }
  };

  // Phase 8: rate a card using server-side SM-2
  const rateCardServer = async (quality: number) => {
    if (!deck || !card || !user?.user_id) return;
    const reviewId = serverReviewMap[card.id];
    if (!reviewId) {
      // Fall back to local review if not yet in server schedule
      const localRating = quality >= 4 ? "easy" : quality === 3 ? "good" : "again";
      await reviewCard(localRating);
      return;
    }
    setSavingReview(true);
    try {
      await api.rateFlashcardReview(reviewId, { user_id: user.user_id, quality });
      // Also update local state for visual feedback
      const localRating = quality >= 4 ? "easy" : quality === 3 ? "good" : "again";
      await reviewCard(localRating);
      // Refresh due stats silently
      (api.getDueFlashcards(user.user_id) as Promise<{ stats: { total_cards: number; due_now: number } }>).then((res) => setDueStats(res.stats)).catch(() => {});
    } finally {
      setSavingReview(false);
    }
  };

  const openSavedDeck = (artifact: SavedArtifact) => {
    const payload = toDeck(artifact.payload);
    setDeck({ ...payload, review_state: payload.review_state || {} });
    setCurrentCard(0);
    setFlipped(false);
    setActiveArtifactId(artifact.id);
  };

  const deleteDeck = async (artifactId: number) => {
    if (!user?.user_id) return;
    if (!window.confirm("Delete this saved deck?")) return;
    try {
      await api.deleteArtifact(artifactId, user.user_id);
      await loadSavedDecks(user.user_id);
      if (activeArtifactId === artifactId) {
        setDeck(null);
        setActiveArtifactId(null);
        setCurrentCard(0);
        setFlipped(false);
      }
    } catch {
      alert("Could not delete this deck right now.");
    }
  };

  const reviewCard = async (rating: "again" | "good" | "easy") => {
    if (!deck || !card) return;
    const key = String(card.id);
    const previous = deck.review_state?.[key];
    const previousInterval = previous?.interval_days || 0;
    const previousMastery = previous?.mastery || 0;

    let intervalDays = 1;
    let mastery = previousMastery;
    if (rating === "good") {
      intervalDays = previousInterval > 0 ? previousInterval * 2 : 2;
      mastery = Math.min(previousMastery + 1, 5);
    } else if (rating === "easy") {
      intervalDays = previousInterval > 0 ? previousInterval * 3 : 4;
      mastery = Math.min(previousMastery + 2, 5);
    } else {
      mastery = Math.max(previousMastery - 1, 0);
    }

    const nextEntry: ReviewEntry = {
      mastery,
      interval_days: intervalDays,
      due_at: daysFromNow(intervalDays),
      review_count: (previous?.review_count || 0) + 1,
      last_reviewed_at: todayIsoDate(),
    };
    const nextDeck: FlashcardDeck = {
      ...deck,
      review_state: {
        ...(deck.review_state || {}),
        [key]: nextEntry,
      },
    };
    setDeck(nextDeck);
    setFlipped(false);
    if (currentCard < deck.cards.length - 1) {
      setCurrentCard((value) => value + 1);
    }
    await persistDeck(nextDeck);
  };

  const card = deck?.cards?.[currentCard];
  const reviewState = deck?.review_state || {};
  const dueCards = deck?.cards?.filter((entry) => {
    const state = reviewState[String(entry.id)];
    return !state || new Date(state.due_at) <= new Date();
  }).length || 0;
  const reviewedCards = Object.keys(reviewState).length;
  const averageMastery = reviewedCards
    ? Math.round(
        Object.values(reviewState).reduce((sum, entry) => sum + (entry.mastery || 0), 0) / reviewedCards * 10
      ) / 10
    : 0;
  const currentReview = card ? reviewState[String(card.id)] : undefined;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ overflowY: "auto" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers3 size={18} style={{ color: "#2563eb" }} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" }}>Flashcards</h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Generate short revision cards, review what is due, and build long-term memory.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card" style={{ padding: 22 }}>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Subject</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        className={`subject-chip ${selectedSub === subject.id ? "selected" : ""}`}
                        onClick={() => onSubjectChange(subject.id)}
                        style={{ fontSize: 12, padding: "6px 11px" }}
                      >
                        {subject.icon} {subject.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Topic</p>
                  {topics.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {topics.map((entry) => (
                        <button
                          key={entry}
                          className={`subject-chip ${topic === entry ? "selected" : ""}`}
                          onClick={() => setTopic(entry)}
                          style={{ fontSize: 12, padding: "5px 10px" }}
                        >
                          {entry}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    className="input"
                    placeholder="Or type a custom topic..."
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && generate()}
                  />
                </div>

                <button className="btn btn-primary btn-full" onClick={generate} disabled={!topic.trim() || loading} style={{ justifyContent: "center", marginBottom: 8 }}>
                  {loading ? "Generating..." : "Generate 6 Flashcards"}
                </button>
                {deck && (
                  <button className="btn btn-secondary btn-full" onClick={shuffleDeck} style={{ justifyContent: "center" }}>
                    <Shuffle size={13} /> Shuffle Deck
                  </button>
                )}
              </div>

              <div className="card" style={{ padding: 22 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <BookOpen size={16} style={{ color: "var(--emerald)" }} /> Saved Decks
                </h2>
                {savedDecks.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Your saved flashcard decks will appear here.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {savedDecks.map((artifact) => (
                      <div key={artifact.id} className="card" style={{ padding: 12 }}>
                        <button onClick={() => openSavedDeck(artifact)} style={{ textAlign: "left", width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{artifact.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{artifact.topic || "Revision deck"}</div>
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => void deleteDeck(artifact.id)} style={{ marginTop: 8, color: "#dc2626" }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              {loading ? (
                // Loading skeleton cards
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="card" style={{ padding: 28, minHeight: 280, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e2e8f0", animation: "pulse 1.5s infinite" }} />
                    <div style={{ width: 200, height: 14, borderRadius: 8, background: "#e2e8f0", animation: "pulse 1.5s infinite" }} />
                    <div style={{ width: 140, height: 12, borderRadius: 8, background: "#e2e8f0", animation: "pulse 1.5s infinite" }} />
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>Sakhi is creating your flashcards…</p>
                  </div>
                </div>
              ) : genError ? (
                // Error state
                <div className="card" style={{ padding: 32, minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", border: "1.5px solid #fecaca", background: "#fef2f2" }}>
                  <AlertCircle size={28} style={{ color: "#dc2626", marginBottom: 12 }} />
                  <p style={{ fontSize: 14, color: "#991b1b", marginBottom: 16 }}>{genError}</p>
                  <button className="btn btn-primary btn-sm" onClick={generate}>
                    <RefreshCw size={13} /> Try Again
                  </button>
                </div>
              ) : !deck || !card ? (
                <div className="card" style={{ padding: 28, minHeight: 420, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                  <div>
                    <Layers3 size={28} style={{ color: "#cbd5e1", margin: "0 auto 12px" }} />
                    <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Generate a flashcard deck to start reviewing.</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    <div className="card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <CalendarClock size={15} style={{ color: "#2563eb" }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Due now</span>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{dueCards}</div>
                    </div>
                    <div className="card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <BookOpen size={15} style={{ color: "var(--emerald)" }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Reviewed</span>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{reviewedCards}</div>
                    </div>
                    <div className="card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Brain size={15} style={{ color: "#ca8a04" }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Avg mastery</span>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{averageMastery}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{deck.topic}</h2>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Card {currentCard + 1} of {deck.cards.length}
                        {currentReview?.due_at ? ` · Due ${new Date(currentReview.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : " · New card"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary btn-sm" onClick={saveDeck} disabled={Boolean(activeArtifactId)}>
                        <Save size={14} /> {activeArtifactId ? "Saved" : "Save Deck"}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={saveToReviewSchedule}
                        disabled={savingSchedule || Object.keys(serverReviewMap).length === deck.cards.length}
                        title="Save all cards to your SM-2 spaced repetition schedule"
                        style={{ color: Object.keys(serverReviewMap).length === deck.cards.length ? "var(--emerald)" : undefined }}
                      >
                        {savingSchedule ? <RefreshCw size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <CheckCircle2 size={13} />}
                        {Object.keys(serverReviewMap).length === deck.cards.length ? "In Schedule ✓" : "Add to Schedule"}
                      </button>
                    </div>
                  </div>
                  {scheduleMsg && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      style={{ padding: "8px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "var(--radius-md)", fontSize: 13, color: "#065f46", fontWeight: 500 }}
                    >{scheduleMsg}</motion.div>
                  )}

                  <motion.button
                    key={`${currentCard}_${flipped ? "back" : "front"}`}
                    className="card"
                    onClick={() => setFlipped((value) => !value)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      minHeight: 340,
                      padding: 28,
                      textAlign: "left",
                      background: flipped ? "#f0fdf4" : "white",
                      border: flipped ? "1px solid #bbf7d0" : "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: flipped ? "var(--emerald)" : "#2563eb", marginBottom: 16 }}>
                        {flipped ? "Back" : "Front"}
                      </div>
                      <p style={{ fontSize: 24, lineHeight: 1.45, color: "var(--text-primary)", fontWeight: 600 }}>
                        {flipped ? card.back : card.front}
                      </p>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
                        Hint: {card.hint}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tap the card to flip it.</div>
                    </div>
                  </motion.button>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setCurrentCard((value) => Math.max(0, value - 1));
                        setFlipped(false);
                      }}
                      disabled={currentCard === 0}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button className="btn btn-secondary" onClick={() => setFlipped((value) => !value)} style={{ flex: 1, justifyContent: "center" }}>
                      <RotateCcw size={14} /> Flip
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setCurrentCard((value) => Math.min(deck.cards.length - 1, value + 1));
                        setFlipped(false);
                      }}
                      disabled={currentCard === deck.cards.length - 1}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="card" style={{ padding: 16, background: "#fafaf9" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>How well did you remember this?</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                      {serverReviewMap[card.id] ? "Synced to your SM-2 schedule ✓" : "Rate to improve recall. Add to schedule to sync with server."}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => void rateCardServer(1)}
                        disabled={savingReview}
                        style={{ justifyContent: "center", flexDirection: "column", height: 56, fontSize: 11, gap: 3, padding: "4px 8px" }}
                      >
                        <span style={{ fontSize: 18 }}>😵</span> Forgot
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => void rateCardServer(2)}
                        disabled={savingReview}
                        style={{ justifyContent: "center", flexDirection: "column", height: 56, fontSize: 11, gap: 3, padding: "4px 8px" }}
                      >
                        <span style={{ fontSize: 18 }}>😅</span> Hard
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => void rateCardServer(3)}
                        disabled={savingReview}
                        style={{ justifyContent: "center", flexDirection: "column", height: 56, fontSize: 11, gap: 3, padding: "4px 8px" }}
                      >
                        <span style={{ fontSize: 18 }}>🙂</span> Okay
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => void rateCardServer(4)}
                        disabled={savingReview}
                        style={{ justifyContent: "center", flexDirection: "column", height: 56, fontSize: 11, gap: 3, padding: "4px 8px" }}
                      >
                        <span style={{ fontSize: 18 }}>😊</span> Easy
                      </button>
                    </div>
                    {savingReview && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Saving review progress...</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
