// Session time tracker — logs study duration per module

import { BASE_URL, readCookie } from "./api";

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
  const csrf = readCookie("sakhi_csrf");
  fetch(`${BASE_URL}/analytics/session-end`, {
    method: "POST",
    body: payload,
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
  }).catch(() => {});
  _start = null;
  _userId = null;
}
