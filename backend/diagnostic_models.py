"""Explicit diagnostic input/output allowlists; learner projections never contain pending keys."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StringConstraints

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
ClassLevel = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
ConceptID = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9-]{0,39}$", max_length=40)]
PositiveID = Annotated[StrictInt, Field(ge=1, le=2**63 - 1)]
AnswerKey = Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{0,18}$", max_length=19)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Concept(Contract):
    id: ConceptID
    label: Label
    prerequisite_ids: list[ConceptID] = Field(max_length=5)
    question_ids: list[PositiveID] = Field(max_length=3)


class Definition(Contract):
    title: Title
    class_level: ClassLevel
    subject: Subject
    concepts: list[Concept] = Field(max_length=6)


class CreateBlueprint(Contract):
    creation_key: UUID
    title: Title
    class_level: ClassLevel
    subject: Subject


class Revision(Contract):
    expected_revision: PositiveID


class SaveBlueprint(Revision):
    definition: Definition


class StartAttempt(Contract):
    creation_key: UUID
    version_id: PositiveID


class Submission(Contract):
    answers: dict[AnswerKey, StrictInt | None] = Field(min_length=1, max_length=18)


class PublicQuestion(Contract):
    id: int
    question_text: str
    options: list[str]


class StaffQuestion(PublicQuestion):
    correct_index: int
    explanation: str


class Version(Contract):
    id: int
    blueprint_id: int
    version_number: int
    draft_revision: int
    class_level: str
    subject: str
    published_at: str
    withdrawn_at: str | None
    concept_count: int
    question_count: int


class Blueprint(Contract):
    id: int
    definition: Definition
    draft_revision: int
    latest_version: Version | None
    preview: list[StaffQuestion]
    preview_warnings: list[str]


class Card(Contract):
    id: int
    title: str
    class_level: str
    subject: str
    concept_count: int
    question_count: int
    latest_version: Version | None
    draft_revision: int | None = None


class BlueprintList(Contract):
    blueprints: list[Card]
    next_after_id: int | None


class Candidates(Contract):
    questions: list[StaffQuestion]
    next_after_id: int | None


class PublicConcept(Contract):
    id: str
    label: str
    prerequisite_ids: list[str]
    questions: list[PublicQuestion]


class Prerequisite(Contract):
    id: str
    label: str


class Counts(Contract):
    correct_count: int
    answered_count: int
    question_count: int
    skipped_count: int


class ConceptResult(Counts):
    id: str
    label: str
    state: Literal["insufficient_evidence", "review_suggested", "provisional_strength"]
    review_prerequisites: list[Prerequisite]
    unassessed_prerequisites: list[Prerequisite]


class ResultItem(Contract):
    question_id: int
    selected_index: int | None
    correct_index: int
    is_correct: bool
    is_skipped: bool
    explanation: str


class NextAction(Contract):
    kind: Literal["collect_evidence", "review", "spaced_practice"]
    concept_id: str | None
    reason: str
    href: Literal["/practice"]


class Result(Counts):
    concept_results: list[ConceptResult]
    items: list[ResultItem]
    next_action: NextAction
    limitations: str


class Attempt(Contract):
    id: str
    version_id: int
    title: str
    class_level: str
    subject: str
    status: Literal["active", "completed"]
    concepts: list[PublicConcept]
    result: Result | None
