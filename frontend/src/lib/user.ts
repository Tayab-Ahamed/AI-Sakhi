export type SakhiLanguage = "English" | "Hinglish" | "Hindi" | "Kannada" | "Tamil";
export type SakhiRole = "student" | "parent" | "teacher" | "admin";

export type SakhiUser = {
  user_id: number;
  message?: string;
  name: string;
  class_: string;
  language: SakhiLanguage;
  weak_subject: string;
  role: SakhiRole;
  organization_id?: number;
  organization_name?: string;
  organization_slug?: string;
  organization_tier?: string;
  created_at?: string;
  updated_at?: string;
  last_active_at?: string;
};

export type SakhiAuth = {
  token: string;
  token_type: string;
  expires_at: string;
  user_id: number;
  organization_id?: number;
  role?: string;
};

const USER_KEY = "sakhi_user";
const SESSION_KEY = "sakhi_session";
const AUTH_KEY = "sakhi_auth";

export function getStoredUser(): SakhiUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SakhiUser;
  } catch {
    return null;
  }
}

export function saveStoredUser(user: SakhiUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredAuth(): SakhiAuth | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SakhiAuth;
  } catch {
    return null;
  }
}

export function saveStoredAuth(auth: SakhiAuth | null) {
  if (typeof window === "undefined") return;
  if (auth) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

export function getSessionId() {
  if (typeof window === "undefined") return "session_ssr";
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = `session_${Date.now()}`;
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

export function getSpeechLang(language: SakhiLanguage) {
  switch (language) {
    case "Hindi":
      return "hi-IN";
    case "Kannada":
      return "kn-IN";
    case "Tamil":
      return "ta-IN";
    case "Hinglish":
      return "hi-IN";
    default:
      return "en-IN";
  }
}

export function getSpeechVoicePrefixes(language: SakhiLanguage) {
  switch (language) {
    case "Hindi":
      return ["hi-IN", "hi_", "hi-"];
    case "Kannada":
      return ["kn-IN", "kn_", "kn-"];
    case "Tamil":
      return ["ta-IN", "ta_", "ta-"];
    case "Hinglish":
      return ["hi-IN", "en-IN", "en-GB", "en-US"];
    default:
      return ["en-IN", "en-GB", "en-US"];
  }
}

export function getLocalizedGreeting(user: SakhiUser) {
  switch (user.language) {
    case "Hindi":
      return `Hi ${user.name}! Main Sakhi hoon. Aaj Class ${user.class_} ko asaan aur mazedaar banate hain. Tum doubt pooch sakti ho, quiz bana sakti ho, ya study plan le sakti ho.`;
    case "Kannada":
      return `Hi ${user.name}! Naanu Sakhi. Indu Class ${user.class_} odannu sulabha mattu nambike inda maadona. Neevu doubt kelabahudu, quiz madabahudu, athava study plan padeyabahudu.`;
    case "Tamil":
      return `Hi ${user.name}! Naan Sakhi. Inru Class ${user.class_} padippai simple-aagavum nambikkaiyudanum seivom. Doubt kelunga, quiz uruvaakkunga, allathu study plan vaangalam.`;
    case "Hinglish":
      return `Hi ${user.name}! Main Sakhi hoon. Aaj Class ${user.class_} ko simple aur confidence ke saath padhenge. Doubt pucho, quiz banao, ya study plan le lo.`;
    default:
      return `Hi ${user.name}! I'm Sakhi. Let's make Class ${user.class_} feel simpler and more confident today. Ask a doubt, generate a quiz, or get a study plan.`;
  }
}
