"""Typed HTTP boundary for student-owned, school-reviewed practice."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StringConstraints

from backend import practice_service as service
from backend.authz import Identity, get_identity
from backend.db import get_connection

router = APIRouter(prefix="/v2/practice", tags=["reviewed-practice"])
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]


class CreateAttempt(BaseModel):
    model_config = ConfigDict(extra="forbid")
    creation_key: UUID
    subject: ShortText
    chapter: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ""
    count: StrictInt = Field(default=5, ge=1, le=10)


class Submission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: dict[str, StrictInt] = Field(min_length=1, max_length=10)


class PublicQuestion(BaseModel):
    id: int
    question_text: str
    options: list[str]


class ResultItem(BaseModel):
    question_id: int
    is_correct: bool
    selected_index: int
    correct_index: int
    explanation: str


class PracticeResult(BaseModel):
    score: int
    total: int
    items: list[ResultItem]
    next_action: str


class Attempt(BaseModel):
    id: str
    subject: str
    chapter: str
    status: str
    questions: list[PublicQuestion]
    result: PracticeResult | None


class Topic(BaseModel):
    subject: str
    chapter: str
    question_count: int


class Topics(BaseModel):
    topics: list[Topic]
    truncated: bool


def student(identity: Identity = Depends(get_identity)) -> Identity:
    if identity.role != "student" or identity.organization_id is None:
        raise HTTPException(403, "Student account in a school required")
    return identity


def _call(function, identity, *args):
    conn = get_connection()
    try:
        return function(conn, identity, *args)
    except service.PracticeError as exc:
        raise HTTPException(exc.status, exc.detail) from None
    finally:
        conn.close()  # rolls back a failed/duplicate transaction before releasing the lock


@router.get("/topics", response_model=Topics)
def topics(identity: Identity = Depends(student)):
    return _call(service.available_topics, identity)


@router.post("/attempts", response_model=Attempt, status_code=201)
def create(req: CreateAttempt, identity: Identity = Depends(student)):
    return _call(service.start_attempt, identity, str(req.creation_key), req.subject, req.chapter, req.count)


@router.get("/attempts/{attempt_id}", response_model=Attempt)
def read(attempt_id: UUID, identity: Identity = Depends(student)):
    return _call(service.read_attempt, identity, str(attempt_id))


@router.post("/attempts/{attempt_id}/submission", response_model=Attempt)
def submit(attempt_id: UUID, req: Submission, identity: Identity = Depends(student)):
    return _call(service.submit_attempt, identity, str(attempt_id), req.answers)
