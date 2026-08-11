"""Edge security middleware.

Handles authentication, default-deny RBAC, tenant isolation, CSRF, body size
limits, request IDs, audit logging and security headers.

This middleware is defence-in-depth. Per-route contracts live in
`backend.authz` as FastAPI dependencies; anything not explicitly public must
still present a valid session here.

Hardening notes:
  * every identifier taken from a body or query string is parsed defensively -
    a non-numeric value returns 400, it never raises a 500;
  * JSON bodies are size-capped before parsing;
  * cookie-authenticated state-changing requests require a double-submit CSRF
    token. Bearer-authenticated API clients are exempt by construction.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import secrets
import time
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse

from backend import metrics
from backend.auth import verify_session_token
from backend.config import settings
from backend.db import get_connection

logger = logging.getLogger("sakhi.security")

PUBLIC_EXACT = {
    "/",
    "/health",
    "/ready",
    "/live",
    "/metrics",
    "/auth/login",
    "/auth/register-invite",
    "/auth/csrf",
    "/user/create",
    "/openapi.json",
}
PUBLIC_PREFIXES = ("/docs", "/redoc")
ADMIN_PREFIXES = ("/users", "/demo/seed", "/admin/")
TEACHER_PREFIXES = ("/analytics/class/", "/organization/roster/")
SELF_PATHS = (
    r"^/user/(\d+)$", r"^/progress/(\d+)$", r"^/reports/user/(\d+)$",
    r"^/analytics/mastery/(\d+)$", r"^/gamification/xp/(\d+)$",
    r"^/analytics/study-time/(\d+)$", r"^/notifications/(\d+)$",
    r"^/recommendations/(\d+)$", r"^/quiz/recommended-difficulty/(\d+)$",
    r"^/chat/sessions/(\d+)$",
    r"^/parent/children/(\d+)$", r"^/report/student/(\d+)$",
    r"^/assignments/student/(\d+)$",
)

CSRF_COOKIE = "sakhi_csrf"
CSRF_HEADER = "x-csrf-token"
STATE_CHANGING = {"POST", "PUT", "PATCH", "DELETE"}


def _deny(status: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail})


def _as_int(value) -> int | None:
    """Parse an untrusted identifier without ever raising."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value.strip())
    return None


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _csrf_ok(request: Request) -> bool:
    cookie_token = request.cookies.get(CSRF_COOKIE)
    header_token = request.headers.get(CSRF_HEADER, "")
    return bool(cookie_token) and hmac.compare_digest(cookie_token, header_token)


def _target_user(user_id: int):
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT organization_id,parent_id FROM users WHERE id=? AND COALESCE(is_active,1)=1",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()


def _same_org(user_id: int, org_id: int | None) -> bool:
    row = _target_user(user_id)
    return bool(row and row["organization_id"] == org_id)


def _can_access_user(actor_id: int, role: str, org_id: int | None, target_id: int) -> bool:
    if role == "admin" or target_id == actor_id:
        return True
    row = _target_user(target_id)
    if not row or row["organization_id"] != org_id:
        return False
    if role == "parent":
        return row["parent_id"] == actor_id
    return role == "teacher"


def _route_label(path: str) -> str:
    """Collapse identifiers so metrics stay low-cardinality."""
    return re.sub(r"/\d+", "/{id}", path)


def _write_audit(request_id: str, uid, org, method: str, path: str, status_code: int, ip: str) -> None:
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO audit_log(request_id,user_id,organization_id,method,path,status_code,ip_hash,created_at) "
            "VALUES(?,?,?,?,?,?,?,datetime('now'))",
            (
                request_id,
                uid,
                org,
                method,
                path,
                status_code,
                hashlib.sha256(ip.encode()).hexdigest()[:16],
            ),
        )
        conn.commit()
        conn.close()
    except Exception:
        logger.exception("audit_log_write_failed")


def _validate_body_identifiers(data: dict, uid: int, role: str, org: int | None):
    """Reject bodies that claim an identity the caller may not act as."""
    numeric_fields = ("user_id", "student_id", "teacher_id", "parent_id", "organization_id")
    parsed: dict[str, int] = {}
    for field in numeric_fields:
        if data.get(field) is None:
            continue
        value = _as_int(data[field])
        if value is None:
            return _deny(400, field + " must be numeric")
        parsed[field] = value

    if "user_id" in parsed and parsed["user_id"] != uid and role != "admin":
        return _deny(403, "User identifier is not authorized")

    if "student_id" in parsed and parsed["student_id"] != uid:
        if role == "student" or (role != "admin" and not _same_org(parsed["student_id"], org)):
            return _deny(403, "Student identifier is not authorized")

    if data.get("role") is not None and data["role"] != role and role != "admin":
        return _deny(403, "Only an administrator may change roles")

    if "teacher_id" in parsed and role == "teacher" and parsed["teacher_id"] != uid:
        return _deny(403, "Teacher identifier is not authorized")

    if "parent_id" in parsed and role == "parent" and parsed["parent_id"] != uid:
        return _deny(403, "Parent identifier is not authorized")

    if "organization_id" in parsed and role != "admin" and parsed["organization_id"] != org:
        return _deny(403, "Organization identifier is not authorized")

    return None


async def security_middleware(request: Request, call_next):
    path = request.url.path
    method = request.method
    started = time.perf_counter()
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    uid = None
    org = None

    if method == "OPTIONS" or path in PUBLIC_EXACT or path.startswith(PUBLIC_PREFIXES):
        response = await call_next(request)
    else:
        auth_header = request.headers.get("authorization", "")
        used_cookie = False
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()
        else:
            token = request.cookies.get("sakhi_token")
            used_cookie = bool(token)

        payload = verify_session_token(token) if token else None
        if not payload:
            metrics.incr("sakhi_auth_failures_total", reason="invalid_token")
            return _deny(401, "Authentication required")

        uid = _as_int(payload.get("sub"))
        if uid is None:
            return _deny(401, "Invalid session token")
        role = payload.get("role", "student")
        org = _as_int(payload.get("org"))
        request.state.auth = payload

        if settings.enable_csrf and used_cookie and method in STATE_CHANGING and not _csrf_ok(request):
            metrics.incr("sakhi_csrf_rejections_total")
            return _deny(403, "Missing or invalid CSRF token")

        if path.startswith(ADMIN_PREFIXES) and role != "admin":
            return _deny(403, "Administrator role required")
        if path.startswith(TEACHER_PREFIXES) and role not in {"teacher", "admin"}:
            return _deny(403, "Teacher or administrator role required")
        if path.startswith("/organizations/") and path.endswith("/generate-code") and role != "admin":
            return _deny(403, "Administrator role required")
        if path == "/parent/link-child" and role != "admin":
            return _deny(403, "Administrator role required")
        if path.startswith("/assignments/submissions/") and role not in {"teacher", "admin"}:
            return _deny(403, "Teacher or administrator role required")
        if (
            method in {"POST", "PUT", "DELETE"}
            and path.startswith("/assignments")
            and "/submit" not in path
            and role not in {"teacher", "admin"}
        ):
            return _deny(403, "Teacher or administrator role required")

        for pattern in SELF_PATHS:
            match = re.match(pattern, path)
            if match:
                target = _as_int(match.group(1))
                if target is None or not _can_access_user(uid, role, org, target):
                    return _deny(403, "User data access denied")
                break

        collection_match = re.match(r"^/(?:artifacts|goals)/(\d+)$", path)
        if method == "GET" and collection_match:
            target = _as_int(collection_match.group(1))
            if target is None or not _can_access_user(uid, role, org, target):
                return _deny(403, "User data access denied")

        org_pattern = r"/(?:leaderboard|analytics/daily-activity|analytics/class|organization/roster)/(\d+)"
        org_match = re.search(org_pattern, path)
        if org_match and role != "admin" and _as_int(org_match.group(1)) != org:
            return _deny(403, "Cross-organization access denied")

        if method in {"POST", "PUT", "PATCH"} and "application/json" in request.headers.get("content-type", ""):
            declared_length = _as_int(request.headers.get("content-length"))
            if declared_length is not None and declared_length > settings.max_json_body_bytes:
                return _deny(413, "Request body too large")

            raw = await request.body()
            if len(raw) > settings.max_json_body_bytes:
                return _deny(413, "Request body too large")

            async def receive():
                return {"type": "http.request", "body": raw, "more_body": False}

            request._receive = receive

            try:
                data = json.loads(raw or b"{}")
            except Exception:
                return _deny(400, "Invalid JSON body")
            if not isinstance(data, dict):
                data = {}

            denial = _validate_body_identifiers(data, uid, role, org)
            if denial is not None:
                return denial

        query_user = request.query_params.get("user_id")
        if query_user:
            target = _as_int(query_user)
            if target is None:
                return _deny(400, "user_id must be numeric")
            if not _can_access_user(uid, role, org, target):
                return _deny(403, "User identifier is not authorized")

        query_org = request.query_params.get("organization_id")
        if query_org:
            target_org = _as_int(query_org)
            if target_org is None:
                return _deny(400, "organization_id must be numeric")
            if role != "admin" and target_org != org:
                return _deny(403, "Organization identifier is not authorized")

        response = await call_next(request)

        if method in STATE_CHANGING:
            ip = request.client.host if request.client else ""
            _write_audit(request_id, uid, org, method, path, response.status_code, ip)

    duration_ms = (time.perf_counter() - started) * 1000
    label = _route_label(path)
    metrics.incr("sakhi_http_requests_total", method=method, route=label, status=str(response.status_code))
    metrics.observe("sakhi_http_request_duration_ms", duration_ms, route=label)

    response.headers["X-Request-ID"] = request_id
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    )
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
    if settings.is_production:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response
