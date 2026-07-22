"""Central authentication, RBAC, tenant isolation, and basic security headers."""
from __future__ import annotations

import json
import os
import re
import hashlib
import uuid
from fastapi import Request
from fastapi.responses import JSONResponse

from backend.auth import verify_session_token
from backend.db import get_connection

PUBLIC_EXACT = {"/", "/health", "/ready", "/auth/login", "/auth/register-invite", "/user/create", "/openapi.json"}
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


def _deny(status: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail})


def _target_user(user_id: int):
    conn = get_connection()
    row = conn.execute("SELECT organization_id,parent_id FROM users WHERE id=? AND COALESCE(is_active,1)=1", (user_id,)).fetchone()
    conn.close()
    return row


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


async def security_middleware(request: Request, call_next):
    path = request.url.path
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    if request.method == "OPTIONS" or path in PUBLIC_EXACT or path.startswith(PUBLIC_PREFIXES):
        response = await call_next(request)
    else:
        auth_header = request.headers.get("authorization", "")
        token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else request.cookies.get("sakhi_token")
        payload = verify_session_token(token) if token else None
        if not payload:
            return _deny(401, "Authentication required")
        request.state.auth = payload
        uid, role, org = int(payload["sub"]), payload.get("role", "student"), payload.get("org")

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
        if request.method in {"POST", "PUT", "DELETE"} and path.startswith("/assignments") and "/submit" not in path and role not in {"teacher", "admin"}:
            return _deny(403, "Teacher or administrator role required")

        # Protect path-scoped user and organization resources.
        for pattern in SELF_PATHS:
            match = re.match(pattern, path)
            if match:
                target = int(match.group(1))
                if not _can_access_user(uid, role, org, target):
                    return _deny(403, "User data access denied")
                break
        collection_match = re.match(r"^/(?:artifacts|goals)/(\d+)$", path)
        if request.method == "GET" and collection_match and not _can_access_user(uid, role, org, int(collection_match.group(1))):
            return _deny(403, "User data access denied")
        org_match = re.search(r"/(?:leaderboard|analytics/daily-activity|analytics/class|organization/roster)/(\d+)", path)
        if org_match and role != "admin" and int(org_match.group(1)) != org:
            return _deny(403, "Cross-organization access denied")

        # Validate identifiers supplied in JSON bodies without trusting the browser.
        if request.method in {"POST", "PUT", "PATCH"} and "application/json" in request.headers.get("content-type", ""):
            raw = await request.body()
            async def receive():
                return {"type": "http.request", "body": raw, "more_body": False}
            request._receive = receive  # replay body for FastAPI
            try:
                data = json.loads(raw or b"{}")
            except Exception:
                return _deny(400, "Invalid JSON body")
            if data.get("user_id") is not None and int(data["user_id"]) != uid and role != "admin":
                return _deny(403, "User identifier is not authorized")
            if data.get("student_id") is not None and int(data["student_id"]) != uid:
                if role == "student" or (role != "admin" and not _same_org(int(data["student_id"]), org)):
                    return _deny(403, "Student identifier is not authorized")
            if data.get("role") is not None and data["role"] != role and role != "admin":
                return _deny(403, "Only an administrator may change roles")
            if data.get("teacher_id") is not None and role == "teacher" and int(data["teacher_id"]) != uid:
                return _deny(403, "Teacher identifier is not authorized")
            if data.get("parent_id") is not None and role == "parent" and int(data["parent_id"]) != uid:
                return _deny(403, "Parent identifier is not authorized")
            if data.get("organization_id") is not None and role != "admin" and int(data["organization_id"]) != org:
                return _deny(403, "Organization identifier is not authorized")
        query_user = request.query_params.get("user_id")
        if query_user and not _can_access_user(uid, role, org, int(query_user)):
            return _deny(403, "User identifier is not authorized")
        query_org = request.query_params.get("organization_id")
        if query_org and role != "admin" and int(query_org) != org:
            return _deny(403, "Organization identifier is not authorized")
        response = await call_next(request)
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            try:
                ip = request.client.host if request.client else ""
                conn = get_connection()
                conn.execute("INSERT INTO audit_log(request_id,user_id,organization_id,method,path,status_code,ip_hash,created_at) VALUES(?,?,?,?,?,?,?,datetime('now'))", (request_id,uid,org,request.method,path,response.status_code,hashlib.sha256(ip.encode()).hexdigest()[:16]))
                conn.commit(); conn.close()
            except Exception:
                pass

    response.headers["X-Request-ID"] = request_id
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=()")
    if os.getenv("SAKHI_ENV") == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response
