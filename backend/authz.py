"""Declarative authorization primitives.

The middleware in `backend.security` is defence-in-depth (default-deny at the
edge). This module gives every route an explicit, readable authorization
contract that lives next to the handler, is visible in the OpenAPI schema, and
is unit-testable without spinning up the whole app:

    @app.get("/reports/user/{user_id}")
    def report(user_id: int, identity: Identity = Depends(require_roles("teacher", "admin"))):
        require_user_access(identity, user_id)

An accompanying audit (`unprotected_routes`) fails CI if a new route is added
without either a public allowlist entry or an authorization dependency.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request, status

from backend.auth import verify_session_token
from backend.db import get_connection, now_iso

ROLES = ("student", "teacher", "parent", "admin")


@dataclass(frozen=True)
class Identity:
    """The authenticated caller."""

    user_id: int
    role: str
    organization_id: int | None
    token_id: str | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_staff(self) -> bool:
        return self.role in {"teacher", "admin"}


def _payload_to_identity(payload: dict) -> Identity:
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session token") from exc
    org = payload.get("org")
    return Identity(
        user_id=user_id,
        role=str(payload.get("role") or "student"),
        organization_id=int(org) if isinstance(org, int | str) and str(org).isdigit() else None,
        token_id=payload.get("jti"),
    )


def get_identity(request: Request) -> Identity:
    """FastAPI dependency returning the authenticated caller (401 if anonymous)."""
    payload = getattr(request.state, "auth", None)
    if not payload:
        auth_header = request.headers.get("authorization", "")
        token = (
            auth_header[7:].strip()
            if auth_header.lower().startswith("bearer ")
            else request.cookies.get("sakhi_token")
        )
        payload = verify_session_token(token) if token else None
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    return _payload_to_identity(payload)


def require_roles(*roles: str) -> Callable[..., Identity]:
    """Dependency factory: allow only the listed roles (admin always allowed)."""
    allowed = {role.lower() for role in roles} | {"admin"}
    unknown = allowed - set(ROLES)
    if unknown:
        raise ValueError(f"Unknown role(s): {sorted(unknown)}")

    def dependency(identity: Identity = Depends(get_identity)) -> Identity:
        if identity.role not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires one of: {', '.join(sorted(allowed))}",
            )
        return identity

    dependency.__name__ = f"require_roles_{'_'.join(sorted(allowed))}"
    dependency.required_roles = frozenset(allowed)  # type: ignore[attr-defined]
    return dependency


require_admin = require_roles("admin")
require_teacher = require_roles("teacher")
require_parent = require_roles("parent")
require_authenticated = require_roles(*ROLES)


def _load_target(user_id: int) -> Any:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT id, organization_id, parent_id FROM users WHERE id=? AND COALESCE(is_active,1)=1",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()


def can_access_user(identity: Identity, target_user_id: int) -> bool:
    """Tenant- and relationship-aware check for reading another user's data."""
    if identity.user_id == target_user_id:
        return True
    row = _load_target(target_user_id)
    if not row or identity.organization_id is None or row["organization_id"] != identity.organization_id:
        return False
    if identity.role in {"teacher", "admin"}:
        return True
    if identity.role == "parent":
        return row["parent_id"] == identity.user_id
    return False


def require_user_access(identity: Identity, target_user_id: int) -> None:
    if not can_access_user(identity, target_user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User data access denied")


def require_same_org(identity: Identity, organization_id: int | None) -> None:
    if organization_id is None or organization_id != identity.organization_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cross-organization access denied")


def require_self(identity: Identity, target_user_id: int) -> None:
    if identity.user_id != target_user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You may only access your own data")


def require_assignment_access(identity: Identity, assignment_id: int, *, edit: bool = False) -> dict:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM assignments WHERE id=? AND is_active=1", (assignment_id,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(404, "Assignment not found")
    require_same_org(identity, row["organization_id"])
    if edit and (not identity.is_staff or (not identity.is_admin and row["teacher_id"] != identity.user_id)):
        raise HTTPException(403, "Assignment access denied")
    return dict(row)


def require_chat_access(identity: Identity, session_id: str, *, claim: bool = False) -> None:
    conn = get_connection()
    try:
        if claim:
            conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT user_id FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
        if row and row["user_id"] != identity.user_id:
            raise HTTPException(403, "Chat session access denied")
        if claim and not row:
            conn.execute(
                "INSERT INTO chat_sessions(session_id,user_id,organization_id,messages_json,profile_json,created_at,updated_at) VALUES(?,?,?,'[]','{}',?,?)",
                (session_id, identity.user_id, identity.organization_id, now_iso(), now_iso()),
            )
        if claim:
            conn.commit()
    finally:
        conn.close()


# ── Route coverage audit ──────────────────────────────────────────────────
def require_request_scope(request: Request, identity: Identity = Depends(get_identity)) -> None:
    """Resource contract for legacy routes while domain handlers are extracted.

    Route templates (not URL prefix guesses) define capabilities. New routes must
    declare their own resource checks; this dependency checks shared identifiers.
    """
    route = request.scope["route"].path
    method = request.method
    if method != "GET" and (
        route.startswith("/ai/")
        or route
        in {
            "/chat",
            "/chat/stream",
            "/chat/upload",
            "/quiz/generate",
            "/quiz/evaluate",
            "/quiz/evaluate-batch",
            "/study-plan",
            "/study-notes/generate",
            "/flashcards/generate",
            "/practice-paper/generate",
        }
    ):
        conn = get_connection()
        try:
            from backend.consent_service import require_ai_approval

            require_ai_approval(conn, identity.user_id)
        finally:
            conn.close()
    staff_routes = {
        "/assignments",
        "/assignments/{assignment_id}/submissions",
        "/assignments/submissions/{submission_id}/feedback",
        "/ai/feedback-suggestion",
        "/analytics/class/{org_id}",
        "/analytics/daily-activity/{org_id}",
        "/organization/roster/{org_id}",
        "/v2/questions",
        "/v2/questions/{question_id}/review",
    }
    admin_routes = {
        "/users",
        "/users/{user_id}",
        "/dashboard",
        "/demo/seed",
        "/admin/invites",
        "/parent/link-child",
        "/organizations/{org_id}/generate-code",
    }
    if route in staff_routes and not identity.is_staff:
        raise HTTPException(403, "Teacher or administrator role required")
    if route in admin_routes and not identity.is_admin:
        raise HTTPException(403, "Administrator role required")
    params = request.path_params
    if "org_id" in params:
        require_same_org(identity, int(params["org_id"]))
    for key in ("user_id", "userId", "child_id", "parent_id"):
        if key in params:
            target = int(params[key])
            if method == "GET" and route != "/v2/privacy/export/{user_id}":
                require_user_access(identity, target)
            elif identity.is_admin and route == "/users/{user_id}":
                require_user_access(identity, target)
            else:
                require_self(identity, target)
    if "session_id" in params:
        require_chat_access(identity, str(params["session_id"]))
    if (
        route in {"/goals/{goal_id}", "/artifacts/{artifact_id}", "/chat/session/{session_id}"}
        and method == "DELETE"
    ):
        target = request.query_params.get("user_id")
        if target is not None:
            require_self(identity, int(target))
    if route in {"/assignments/detail/{id}", "/assignments/{id}", "/assignments/{assignment_id}"}:
        assignment_id = int(params.get("id") or params["assignment_id"])
        item = require_assignment_access(identity, assignment_id, edit=method != "GET")
        if identity.role == "student":
            conn = get_connection()
            try:
                student = conn.execute("SELECT class FROM users WHERE id=?", (identity.user_id,)).fetchone()
            finally:
                conn.close()
            if not student or str(student["class"]) != str(item["class_"]):
                raise HTTPException(403, "Assignment access denied")


_AUTH_DEPENDENCY_NAMES = ("get_identity", "require_roles", "require_admin", "require_teacher")


def _route_has_auth_dependency(route: Any) -> bool:
    dependant = getattr(route, "dependant", None)
    if dependant is None:
        return False
    stack = [dependant]
    while stack:
        current = stack.pop()
        call = getattr(current, "call", None)
        name = getattr(call, "__name__", "")
        if any(name.startswith(prefix) for prefix in _AUTH_DEPENDENCY_NAMES):
            return True
        stack.extend(getattr(current, "dependencies", []) or [])
    return False


def unprotected_routes(
    app: Any, public_paths: Iterable[str], public_prefixes: Sequence[str] = ()
) -> list[str]:
    """Return `METHOD /path` strings that are neither public nor auth-guarded.

    Routes covered only by the edge middleware still show up here; that is
    intentional, it is the backlog for migrating authorization into explicit
    dependencies.
    """
    public = set(public_paths)
    findings: list[str] = []
    for route in getattr(app, "routes", []):
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if not path or not methods:
            continue
        if path in public or any(path.startswith(prefix) for prefix in public_prefixes):
            continue
        if _route_has_auth_dependency(route):
            continue
        for method in sorted(methods - {"HEAD", "OPTIONS"}):
            findings.append(f"{method} {path}")
    return sorted(findings)
