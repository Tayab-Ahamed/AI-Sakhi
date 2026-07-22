// Session time tracker — logs study duration per module

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let _start: number | null = null;
let _module = "";
let _userId: number | null = null;

export function startTimer(module: string, userId: number) {
  _start = Date.now();
  _module = module;
  _userId = userId;
}

export function stopTimer() {
  if (!_start || !_userId) return;
  const duration = Math.round((Date.now() - _start) / 1000);
  if (duration < 5) return; // ignore very short visits
  const payload = JSON.stringify({
    user_id: _userId,
    module: _module,
    duration_seconds: duration,
  });
  let token = "";
  try { token = JSON.parse(localStorage.getItem("sakhi_auth") || "{}").token || ""; } catch { token = ""; }
  fetch(`${BASE_URL}/analytics/session-end`, {
    method: "POST",
    body: payload,
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).catch(() => {});
  _start = null;
  _userId = null;
}
