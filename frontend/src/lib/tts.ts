// Text-to-Speech utilities using Web Speech API

const LANG_MAP: Record<string, string> = {
  english: "en-IN",
  hindi: "hi-IN",
  hinglish: "hi-IN",
  kannada: "kn-IN",
  tamil: "ta-IN",
};

let utterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, language = "English") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  stopSpeaking();
  const lang = LANG_MAP[language.toLowerCase()] || "en-IN";
  // Strip markdown syntax for cleaner speech
  const clean = text
    .replace(/[*_#`~>\[\]]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/https?:\/\/\S+/g, "")
    .trim();
  utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  // Try to pick a matching voice
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
  if (match) utterance.voice = match;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  utterance = null;
}

export function isSpeaking(): boolean {
  if (typeof window === "undefined") return false;
  return window.speechSynthesis?.speaking || false;
}
