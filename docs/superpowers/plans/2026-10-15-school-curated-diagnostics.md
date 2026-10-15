# School-Curated Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a school-curated diagnostic workflow with versioned prerequisite graphs, server-owned evidence and an accessible student/staff experience.

**Architecture:** Add one bounded diagnostic domain beside reviewed practice. Pure rules validate graphs and score snapshots; short SQLite transactions own publication and attempts; explicit FastAPI contracts expose only authorized fields. Dedicated React components consume typed responses without mutating legacy mastery.

**Tech Stack:** Existing Python/FastAPI/Pydantic/SQLite; Next.js 16.4.0, React 19.2.4, TypeScript, Vitest/RTL; preinstalled Playwright and installed Edge for synthetic browser checks. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-school-curated-diagnostics-design.md`, approved October 15, 2026.

## Global Constraints

- No new runtime dependency or paid service is needed.
- Students take only assessments for their current school and class.
- No initial prerequisite relationships or question mappings are invented from chapter order.
- Assessment evidence remains separate from legacy topic/mastery scores in this phase.
- Publish only when there are 1–6 concepts and exactly three distinct, valid, approved MCQs per concept. Maximum assessment length is 18 questions.
- Concept IDs match `^[a-z][a-z0-9-]{0,39}$`; labels contain 1–80 trimmed characters.
- Enforce a maximum 1,000 characters per option, 5,000 for question text and 5,000 for explanation in diagnostic eligibility, including historical records.
- A null selection is skipped, not incorrect. Previous attempts and legacy progress do not increase the diagnostic's confidence.
- Only the latest published version may start a new attempt, and only while it is not withdrawn. Do not fall back to an earlier version when the latest is withdrawn.
- Offline mode offers reconnection; diagnostics are not cached by the service worker or queued for later submission.
- Keep real databases, vector stores, credentials, published owner policy and deployment untouched. Tests use temporary databases and synthetic accounts.
- Preserve the existing dirty working tree. Commit only changes attributable to each task; inspect staged content and do not use blanket staging or destructive resets. If a task's hunks cannot be safely isolated from existing changes, leave the verified work uncommitted and record that limitation rather than force a baseline commit or commit someone else's work.
- Read `frontend/AGENTS.md` and the relevant bundled Next.js guides before writing frontend code.

## Review Focus

1. Invalid historical question rows fill an entire candidate page: pagination must advance without loading an unbounded bank or getting stuck (Task 4).
2. A new version is published after an attempt-creation response is lost: the same creation intent must recover the old eligible attempt, not create a new one (Task 5).
3. A publisher is erased after another learner completes an assessment: retain anonymous historical evidence, but never reactivate an older publication (Task 7).
4. Reload occurs after submission commits but before its response arrives: recover the completed server result without another event or legacy progress row (Tasks 5, 10).
5. Renaming/removing a concept would leave dangling edges or question mappings: reject the inconsistent draft and preserve the saved revision (Tasks 2, 9).

## Execution State and Repository Map

Plan approved October 15, 2026. User selected Native: sequential implementation here, with an independent final review. Completed steps reflect the task ledger and its explicit rulings, including inseparable uncommitted integration files. Detailed steps live here; `tasks/todo.md` remains the overall roadmap tracker.

Implementation accepted October 15: 247 backend tests, 145 frontend tests, lint/types/build/reference graders and eleven real-browser cases. Original independent review found two Important recovery gaps, fixed in one observed RED→GREEN pass; two minors remain deferred. See `docs/verification-diagnostics.md` and the preserved plan-scoped ledger for exact evidence, rulings and integration/release limits. No second review was dispatched.

Pre-implementation schema ended at migration 9. Migration 10 was confirmed next and added without renumbering existing migrations; fresh/rerun/partial-upgrade checks use temporary databases only.

| File group | Responsibility |
| --- | --- |
| `backend/question_rules.py` | Existing MCQ interpretation extracted without behavior changes. |
| `backend/diagnostic_rules.py` | Bounded definitions, DAG ordering, eligible snapshots, answer validation and evidence. |
| `backend/diagnostic_service.py` | Scoped drafts/publications/attempts and transactions; keep business logic out of main/routes. |
| `backend/diagnostic_models.py`, `backend/diagnostic_routes.py` | Typed HTTP input/output and error conversion. |
| `backend/diagnostic_privacy.py` | Export/erasure projections used by the canonical privacy service. |
| `frontend/src/lib/diagnostics.ts`, `diagnostic-resume.ts` | DTOs and account-scoped, noncredential resume references. |
| `frontend/src/components/diagnostics/*` | Small staff editor, concept controls, preview and learner components. |
| `/diagnostics`, `/teacher/diagnostics` | Authenticated page shells; reuse existing sidebar/tokens. |
| `backend/tests/test_diagnostic_*.py`, colocated RTL tests, `tests/e2e/sakhi.spec.cjs` | Pure, transactional, boundary and actual-browser verification. |

## Shared Interface Contract

Definitions use `title`, `class_level`, `subject`, and `concepts`. A draft concept has `id`, `label`, `prerequisite_ids: list[str]`, and `question_ids: list[int]`. A published concept replaces `question_ids` with private `questions` snapshots. A snapshot has `id`, `question_text`, `options`, `correct_index`, and `explanation`.

A public attempt contains `id` (UUID), `version_id`, `title`, `class_level`, `subject`, `status` (`active|completed`), public `concepts`, and `result`. Active questions expose only ID/text/options; `result` is null. Completed feedback adds selected/correct index, correctness/skip and explanation for this owner only.

Result fields: `correct_count`, `answered_count`, `question_count`, `skipped_count`, `concept_results`, `items`, `next_action`, and `limitations`. Each concept result includes its ID/label/counts/state and separate `review_prerequisites` / `unassessed_prerequisites` arrays of ID/label pairs. `next_action` is `{kind, concept_id, reason, href}`; `kind` is `collect_evidence|review|spaced_practice`, `concept_id` may be null, and `href` is always `/practice`.

Service functions accept an open connection and trusted `Identity`; write functions own BEGIN/COMMIT, and the caller always closes the connection. `DiagnosticError(status: int, detail: str)` carries bounded public errors; `DiagnosticRuleError` means 422. Never put a private snapshot in exception text.

The public list envelope is `{blueprints, next_after_id}`. Staff cards include draft revision and latest publication metadata, never another school's content. Student cards include only eligible latest-version metadata/counts. Pagination uses `after_id >= 0`, `1 <= limit <= 100`, stable ID order, and `limit + 1` bounded reads. Candidate envelopes are `{questions, next_after_id}`; their cursor advances by the last scanned ID even if invalid historical rows are omitted.

Staff `read_blueprint` also returns `preview` (bounded current own-school selected question snapshots) and `preview_warnings` for unavailable selections. It reads at most 18 IDs and produces no attempts/events. This lets a saved draft be previewed after reload without assuming its selected questions are on the current candidate page. Cross-school or missing selections get the same unavailable warning.

The shared fixture helper `published_blueprint(...)` returns `{blueprint, version, question_ids, definition}`. `version.id` is the version ID; `blueprint.id` is the editable blueprint ID. These names are used consistently by the tests below.

### Task 1: Preserve and share reviewed-MCQ interpretation

**Files:** Create `backend/question_rules.py`, `backend/tests/test_question_rules.py`; modify `backend/practice_service.py`.
**Interfaces:** Consume the current `mcq_snapshot(row: dict) -> dict | None`; produce the same function in `question_rules`, re-exported by import in practice so existing callers remain compatible.

- [x] Write characterisation tests before moving the function:

```python
def test_letter_key_keeps_precedence_over_option_text():
    from backend.question_rules import mcq_snapshot
    row = {"id": 1, "question_text": "Choose a value", "options_json": '["B", "A"]',
           "correct_answer": "A", "explanation": "School explanation"}
    assert mcq_snapshot(row)["correct_index"] == 0

def test_duplicate_options_are_not_eligible():
    from backend.question_rules import mcq_snapshot
    row = {"id": 1, "question_text": "Choose a value", "options_json": '["One", " one "]',
           "correct_answer": "A", "explanation": ""}
    assert mcq_snapshot(row) is None
```

- [x] Run `python -m pytest backend/tests/test_question_rules.py -p no:cacheprovider --show-capture=no`; confirm the missing-module failure before the move.
- [x] Move the current function unchanged; add `from backend.question_rules import mcq_snapshot` to practice. Do not add diagnostic length rules to existing practice in this extraction.
- [x] Add malformed JSON, non-list options, 1/11 options, blank values, invalid keys and exact-option key cases.
- [x] Run the focused file and `backend/tests/test_reviewed_practice.py`; both must pass. Inspect the diff for behavior changes, then commit only these three files with `refactor: share reviewed MCQ interpretation`.

### Task 2: Implement deterministic graph and evidence rules

**Files:** Create `backend/diagnostic_rules.py`, `backend/tests/test_diagnostic_rules.py`.
**Interfaces:** Consume `question_rules.mcq_snapshot`; produce `validate_definition(definition, *, complete=False) -> dict`, `topological_ids(concepts) -> list[str]`, `diagnostic_snapshot(row) -> dict | None`, `score_definition(snapshot, answers) -> dict`, and `public_definition(snapshot) -> dict`.

- [x] Write an executable fixture inside the test module: a two-concept chain with IDs `base`, `next`; each has three questions, sequential IDs 1–6, options `['Yes', 'No']`, correct index 0 and a school explanation. `next.prerequisite_ids` is `['base']`.

```python
import pytest

@pytest.fixture
def snapshot():
    concepts = []
    for position, (concept_id, label) in enumerate((("base", "Foundations"), ("next", "Next idea"))):
        concepts.append({"id": concept_id, "label": label,
            "prerequisite_ids": [] if position == 0 else ["base"],
            "questions": [{"id": position * 3 + i, "question_text": f"School question {position * 3 + i}",
                "options": ["Yes", "No"], "correct_index": 0, "explanation": "School explanation"}
                for i in range(1, 4)]})
    return {"title": "School check", "class_level": "8", "subject": "Math", "concepts": concepts}
```
- [x] Write the first failing scoring tests:

```python
def test_skips_are_insufficient_evidence_not_incorrect(snapshot):
    from backend.diagnostic_rules import score_definition
    result = score_definition(snapshot, {str(i): None for i in range(1, 7)})
    assert result["answered_count"] == result["correct_count"] == 0
    assert result["skipped_count"] == result["question_count"] == 6
    assert all(c["state"] == "insufficient_evidence" for c in result["concept_results"])
    assert result["next_action"]["kind"] == "collect_evidence"

def test_review_of_prerequisite_is_explained(snapshot):
    from backend.diagnostic_rules import score_definition
    result = score_definition(snapshot, {str(i): (1 if i <= 3 else 0) for i in range(1, 7)})
    base, advanced = result["concept_results"]
    assert base["state"] == "review_suggested"
    assert advanced["review_prerequisites"] == [{"id": "base", "label": "Foundations"}]
    assert result["next_action"]["concept_id"] == "base"
```

- [x] Run `python -m pytest backend/tests/test_diagnostic_rules.py -p no:cacheprovider --show-capture=no`; observe failure before implementation.
- [x] Use a stable Kahn topological sort: validate local IDs/edges, repeatedly select the earliest saved concept with zero remaining prerequisites, remove its outgoing edges, and reject if fewer than all concepts are emitted. Do not infer edges or reorder unrelated concepts alphabetically.
- [x] Validate metadata bounds, at most six concepts, duplicate concepts/edges/question IDs, unknown/self references and cycles. Drafts allow zero concepts and 0–3 questions per concept; publication requires 1–6 concepts and exactly three each.
- [x] Implement strict answer-map validation using exact question IDs and `type(value) is int` or null; reject bool/string/float, missing/extra keys and out-of-range indices. Classify each concept using the exact three-row spec table; compute ancestor reasons and first non-strength topological next action. All-strength gets spaced practice, never mastery.
- [x] Add tests for dangling edges after rename/removal, stable ties, indirect cycles, Unicode/blank labels, length bounds, every evidence state, all-correct, all-wrong, mixed skips and key-free public projection. Diagnostic snapshot length checks precede large JSON parsing where practical.
- [x] Run the focused file, Ruff/format, review every spec scoring rule, and commit the two files with `feat: add conservative diagnostic evidence rules`.

### Task 3: Add isolated storage and revision-safe staff drafts

**Files:** Modify `backend/migrations.py`; create `backend/diagnostic_service.py`, `backend/tests/test_diagnostic_drafts.py`, `backend/tests/diagnostic_helpers.py`.
**Interfaces:** Consume trusted `Identity`, `get_connection`, `now_iso`, `validate_definition`; produce `create_blueprint(conn, identity, creation_key, title, class_level, subject)`, `read_blueprint(conn, identity, blueprint_id)`, `save_blueprint(conn, identity, blueprint_id, expected_revision, definition)`, and `list_blueprints(conn, identity, after_id=0, limit=100)`.

- [x] In `diagnostic_helpers.py`, define `invoke(function, ids, actor, **kwargs)`: map `classmate` to student and `other_*` to school 2, construct the fixture Identity, open `db.get_connection()`, call `function(conn, identity, **kwargs)`, and close in `finally`. Tests use the existing `school_api` fixture; no network/server initialization is added.
- [x] Write draft tests before schema/service code:

```python
def test_duplicate_draft_create_is_stable(school_api):
    from uuid import uuid4
    from backend import diagnostic_service as service
    from backend.tests.diagnostic_helpers import invoke
    _, ids, *_ = school_api
    values = dict(creation_key=str(uuid4()), title="School check", class_level="8", subject="Math")
    first = invoke(service.create_blueprint, ids, "teacher", **values)
    again = invoke(service.create_blueprint, ids, "teacher", **values)
    assert first == again
    assert first["draft_revision"] == 1
```

- [x] Run `python -m pytest backend/tests/test_diagnostic_drafts.py -p no:cacheprovider --show-capture=no` and observe failure.
- [x] Add the next migration with three tables from the spec. Use nullable creator/publisher foreign keys with `ON DELETE SET NULL`; unique blueprint creation intent `(organization_id, created_by, creation_key)`, unique publication `(blueprint_id, draft_revision)`, unique attempt `(user_id, creation_key)`, and status/revision checks. Add composite unique parent keys and foreign keys so version/attempt school/class references cannot mismatch. Add scope/list indexes. Check fresh, legacy and rerun migration tests.

Canonical storage columns for the migration and service SQL:

```sql
CREATE TABLE diagnostic_blueprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    creation_key TEXT NOT NULL,
    creation_fingerprint TEXT NOT NULL,
    definition_json TEXT NOT NULL,
    draft_revision INTEGER NOT NULL DEFAULT 1 CHECK(draft_revision > 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(organization_id, created_by, creation_key), UNIQUE(id, organization_id)
);
CREATE TABLE diagnostic_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blueprint_id INTEGER NOT NULL, organization_id INTEGER NOT NULL,
    class_level TEXT NOT NULL, subject TEXT NOT NULL,
    version_number INTEGER NOT NULL CHECK(version_number > 0),
    draft_revision INTEGER NOT NULL CHECK(draft_revision > 0),
    snapshot_json TEXT NOT NULL,
    published_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    published_at TEXT NOT NULL, withdrawn_at TEXT,
    UNIQUE(blueprint_id, draft_revision), UNIQUE(blueprint_id, version_number),
    UNIQUE(id, organization_id, class_level),
    FOREIGN KEY(blueprint_id, organization_id)
        REFERENCES diagnostic_blueprints(id, organization_id) ON DELETE RESTRICT
);
CREATE TABLE diagnostic_attempts (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL, class_level TEXT NOT NULL, version_id INTEGER NOT NULL,
    creation_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'completed')),
    answers_json TEXT, result_json TEXT, created_at TEXT NOT NULL, submitted_at TEXT,
    UNIQUE(user_id, creation_key),
    FOREIGN KEY(version_id, organization_id, class_level)
        REFERENCES diagnostic_versions(id, organization_id, class_level) ON DELETE RESTRICT
);
CREATE INDEX idx_diagnostic_school ON diagnostic_blueprints(organization_id, id);
CREATE INDEX idx_diagnostic_user ON diagnostic_attempts(user_id, created_at DESC);
```

Use `CREATE ... IF NOT EXISTS` in the actual migration so the repository's rerun/partial-upgrade tests remain supported. Compare the stored immutable `creation_fingerprint` with normalized original create parameters, not a later edited draft definition. Consistent JSON encoding is `json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)`.
- [x] Require current active staff/school for drafts and re-read current active student/class for student lists. Writes use `BEGIN IMMEDIATE`; identical creation fingerprints recover, changed reuse conflicts. Draft replacement checks revision and increments once; validation fails before changing the saved draft.
- [x] Add stale-edit/dangling-edge preservation tests, four concurrent creates, changed-key reuse, wrong roles and other-school 404s. List latest publications with a bounded SQL join, not one query per row.
- [x] Run the focused file and `backend/tests/test_migrations.py`; commit the four files with `feat: add school-scoped diagnostic drafts`.

### Task 4: Publish immutable, currently eligible assessments

**Files:** Modify `backend/diagnostic_service.py`; create `backend/tests/test_diagnostic_publication.py`; extend `backend/tests/diagnostic_helpers.py`.
**Interfaces:** Produce `question_candidates(conn, identity, blueprint_id, after_id=0, limit=100)`, `publish_blueprint(conn, identity, blueprint_id, expected_revision)`, `withdraw_version(conn, identity, version_id)`. Helper `approved_questions(client, headers, count, chapter='Diagnostic foundations') -> list[int]` creates valid Math/class-8 MCQs through existing question/review APIs; `published_blueprint(client, ids, headers, concepts=1) -> dict` builds/publishes a complete service draft.

- [x] Write failing tests for incomplete coverage, cross-school/class/subject question IDs and publication replay. An identical publication replay checks `(blueprint_id, expected_revision)` before rejecting a later draft revision; it returns the original version, even if withdrawn, without reactivating it.

```python
def test_publication_replay_cannot_reactivate_withdrawn_version(school_api):
    from backend import diagnostic_service as service
    from backend.tests.diagnostic_helpers import invoke, published_blueprint
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    version = configured["version"]
    invoke(service.withdraw_version, ids, "teacher", version_id=version["id"])
    replay = invoke(service.publish_blueprint, ids, "teacher",
        blueprint_id=configured["blueprint"]["id"], expected_revision=version["draft_revision"])
    assert replay["id"] == version["id"]
    assert replay["withdrawn_at"] is not None
    assert invoke(service.list_blueprints, ids, "student")["blueprints"] == []
```
- [x] Run `python -m pytest backend/tests/test_diagnostic_publication.py -p no:cacheprovider --show-capture=no` before implementation.
- [x] Add SQL text/JSON-length bounds and keyset pagination before fetching at most `limit + 1` candidate rows. Use diagnostic eligibility to omit malformed rows; advance `next_after_id` by the scanned page boundary, even when all rows are invalid.
- [x] Publish in one transaction: load own-school draft, validate full coverage/DAG, fetch the at-most-18 referenced own-school/class/subject questions, validate current approval/content, snapshot in stable order, insert immutable next version and commit. Candidate/body failures contain no private keys.
- [x] Implement terminal, idempotent withdrawal. List latest version using maximum version number before applying withdrawal/class eligibility; never select “most recent active” as a fallback.
- [x] Add tests for 101 historical invalid rows followed by one valid candidate, strict cursor advance, exact subject mismatch, duplicate question reuse, four-way publication races, failed publication rollback, withdrawn-latest hiding and key-free student list metadata.
- [x] Run publication/draft/rule tests and Ruff/format; commit only the task files with `feat: publish reviewed diagnostic versions`.

### Task 5: Own attempts and atomic, retry-safe completion

**Files:** Modify `backend/diagnostic_service.py`; create `backend/tests/test_diagnostic_attempts.py`; extend `backend/tests/diagnostic_helpers.py` only for the complete two-concept fixture.
**Interfaces:** Produce `start_attempt(conn, identity, creation_key, version_id)`, `read_attempt(conn, identity, attempt_id)`, `submit_attempt(conn, identity, attempt_id, answers)`. Return the shared public-attempt contract; only completion exposes own feedback.

- [x] Write a failing test for repeated submission: create/publish a fixture, start as student, submit all indices 0 twice, assert equal results, one `diagnostic_completed` event and zero new legacy progress rows. Use a new DB connection for counts, never a global/live DB.

```python
def test_identical_submission_commits_once_without_mastery_inflation(school_api):
    from uuid import uuid4
    from backend import db, diagnostic_service as service
    from backend.tests.diagnostic_helpers import invoke, published_blueprint
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    attempt = invoke(service.start_attempt, ids, "student",
        creation_key=str(uuid4()), version_id=configured["version"]["id"])
    answers = {str(qid): 0 for qid in configured["question_ids"]}
    first = invoke(service.submit_attempt, ids, "student", attempt_id=attempt["id"], answers=answers)
    assert invoke(service.submit_attempt, ids, "student", attempt_id=attempt["id"], answers=answers) == first
    conn = db.get_connection()
    try:
        assert conn.execute("SELECT COUNT(*) FROM learning_events WHERE user_id=? AND event_type='diagnostic_completed'",
                            (ids["student"],)).fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM progress WHERE user_id=?", (ids["student"],)).fetchone()[0] == 0
    finally:
        conn.close()
```
- [x] Run `python -m pytest backend/tests/test_diagnostic_attempts.py -p no:cacheprovider --show-capture=no` before implementation.
- [x] For start, lock and read an existing `(user_id, creation_key)` first. Recover it if the intent/version and current account scope match and pending content remains eligible; only new intents require latest-version eligibility. This ordering preserves recovery after a newer publication.
- [x] Centralize pending eligibility: current own user/school/class, non-withdrawn version and still-approved exact question snapshots. Completed reads/replays skip content-recall checks but never owner/current-scope checks. No duplicate API-side grade/progress fallback.
- [x] Submission locks, loads the attempt, validates all answers, replays identical completed answers or conflicts on different answers, checks pending content, scores, stores completion and inserts one minimal event, then commits. Event metadata contains IDs/counts, not questions, keys or raw answers.
- [x] Add four-way start/submit races, newer publication after lost creation response, changed-key conflict, recalled/edited question, withdrawn version, superseded eligible version, class/school change, deactivation, all-skip and completed historical read tests. Inject failure after attempt update but before event insertion; assert both rolled back. Read a completed attempt after simulated response loss and assert event count stays one.
- [x] Run all diagnostic and reviewed-practice tests, review transaction boundaries, and commit with `feat: score private diagnostic attempts atomically`.

### Task 6: Expose strict HTTP contracts and route authorization

**Files:** Create `backend/diagnostic_models.py`, `backend/diagnostic_routes.py`, `backend/tests/test_diagnostic_authorization.py`; modify `backend/main.py`.
**Interfaces:** Implement the ten spec endpoints under `/v2/diagnostics`, with response models matching the shared contract. Produce `router`; consume service functions and `get_identity`.

- [x] Write missing-route tests using `school_api`, including a forged score/key:

```python
def test_blueprint_creation_forbids_caller_owned_school(school_api):
    from uuid import uuid4
    client, _, headers, *_ = school_api
    response = client.post('/v2/diagnostics/blueprints', headers=headers('teacher'), json={
        'creation_key': str(uuid4()), 'title': 'Check', 'class_level': '8',
        'subject': 'Math', 'organization_id': 2,
    })
    assert response.status_code == 422
```

- [x] Run `python -m pytest backend/tests/test_diagnostic_authorization.py -p no:cacheprovider --show-capture=no`; the first run must fail before routes exist.
- [x] Define all input models with `ConfigDict(extra='forbid')`, bounded trimmed strings, `StrictInt`, UUID intent/attempt IDs and strict integer-or-null answer maps of 1–18 entries. Bound blueprint/version numeric IDs and pagination. Define explicit public/private DTO projections; students never receive staff snapshots.
- [x] Follow the existing route/service `_call` pattern with connection `finally` closure and bounded rule/domain error conversion. Every endpoint explicitly depends on `get_identity`; service functions enforce method-specific live role/resource scope. Add one import/router registration in main, not business logic.
- [x] Add route-policy audit coverage, anonymous 401, adult-role 403, cross-user/school 404, stale 409 and invalid 422 cases; exercise real cookie/CSRF writes, live role/deactivation and absence of keys in errors. Assert repeated GETs create no events/mastery snapshots and no model-generating route is invoked.
- [x] Run authorization, all diagnostic, cookie/route-audit tests and Ruff/format; commit the four files with `feat: expose authorized diagnostic API contracts`.

### Task 7: Cover diagnostic privacy and publisher erasure

**Files:** Create `backend/diagnostic_privacy.py`, `backend/tests/test_diagnostic_privacy.py`; modify `backend/privacy_service.py`.
**Interfaces:** Produce `export_diagnostics(conn, user_id) -> dict` and `erase_diagnostics(conn, user_id) -> None`; these do not commit, so the existing privacy transaction owns completion.

- [x] Write a failing export test: an active student attempt exports public questions and own metadata only; recursively serialize and assert absence of `correct_index`, `explanation`, raw version `snapshot_json` and other students' attempts.

```python
def test_pending_export_has_no_private_version_snapshot(school_api):
    import json
    from uuid import uuid4
    from backend import db, diagnostic_service as service
    from backend.privacy_service import export_data
    from backend.tests.diagnostic_helpers import invoke, published_blueprint
    client, ids, headers, *_ = school_api
    configured = published_blueprint(client, ids, headers)
    invoke(service.start_attempt, ids, "student", creation_key=str(uuid4()),
           version_id=configured["version"]["id"])
    conn = db.get_connection()
    try:
        exported = export_data(conn, ids["student"])["diagnostic_attempts"]
        assert len(exported) == 1
        text = json.dumps(exported)
        assert not any(key in text for key in ("correct_index", "explanation", "snapshot_json"))
    finally:
        conn.close()
```
- [x] Run `python -m pytest backend/tests/test_diagnostic_privacy.py -p no:cacheprovider --show-capture=no` before implementation.
- [x] Export own attempts with allowlisted projections, adding feedback only after completion. Staff author export follows own-authored data policy and must not gather other learners' attempts through versions. Do not expose full published snapshots to a student through joins.
- [x] Erase owned attempts and existing owned learning events inside canonical privacy erasure. Remove creator-owned drafts without historical consumers; anonymize creator/publisher IDs for retained school history. Withdraw all retained versions of an erased creator's blueprint rather than deleting the latest and exposing an older one; clear unpublished draft text to a valid empty draft and increment its revision. Completed evidence for other students remains readable; pending attempts affected by recall/withdrawal stop. A subsequent staff publication requires a newly reviewed draft and version.
- [x] Add publisher-erasure after another learner's completion, null-author FK, no-earlier-version-reactivation, failed privacy transaction rollback, active-vs-completed export and cross-user isolation cases. State free-text/school-history and backup limitations in the privacy documentation, not a compliance claim.
- [x] Run diagnostic privacy plus the existing privacy/authorization suite; commit only task files with `feat: include diagnostic evidence in privacy lifecycle`.

### Task 8: Add typed frontend API and scoped online resume

**Files:** Create `frontend/src/lib/diagnostics.ts`, `frontend/src/lib/diagnostic-resume.ts`, `frontend/src/lib/diagnostic-resume.test.ts`; modify `frontend/src/lib/api.ts`, `frontend/src/lib/device-data.test.ts`.
**Interfaces:** Define `DiagnosticDefinition`, `DiagnosticConcept`, `DiagnosticBlueprint`, `DiagnosticVersion`, `DiagnosticAttempt`, `DiagnosticResult`, `DiagnosticList`, `DiagnosticCandidates`, `DiagnosticAnswers = Record<string, number | null>`, and `DiagnosticIdentity = {user_id:number; organization_id:number; class_:string}`. API helpers: `listDiagnosticBlueprints`, `createDiagnosticBlueprint`, `getDiagnosticBlueprint`, `saveDiagnosticBlueprint`, `getDiagnosticCandidates`, `publishDiagnosticBlueprint`, `withdrawDiagnosticVersion`, `startDiagnostic`, `getDiagnosticAttempt`, `submitDiagnostic`.

Exact API wrapper signatures (all return Promises of the named DTO):

```typescript
type DiagnosticPage = { after_id?: number; limit?: number };
type DiagnosticCreate = { creation_key: string; title: string; class_level: string; subject: string };
type DiagnosticSave = { expected_revision: number; definition: DiagnosticDefinition };
type DiagnosticPublish = { expected_revision: number };
type DiagnosticStart = { creation_key: string; version_id: number };
type DiagnosticApiContract = {
  listDiagnosticBlueprints(page?: DiagnosticPage): Promise<DiagnosticList>;
  createDiagnosticBlueprint(input: DiagnosticCreate): Promise<DiagnosticBlueprint>;
  getDiagnosticBlueprint(id: number): Promise<DiagnosticBlueprint>;
  saveDiagnosticBlueprint(id: number, input: DiagnosticSave): Promise<DiagnosticBlueprint>;
  getDiagnosticCandidates(id: number, page?: DiagnosticPage): Promise<DiagnosticCandidates>;
  publishDiagnosticBlueprint(id: number, input: DiagnosticPublish): Promise<DiagnosticVersion>;
  withdrawDiagnosticVersion(id: number): Promise<DiagnosticVersion>;
  startDiagnostic(input: DiagnosticStart): Promise<DiagnosticAttempt>;
  getDiagnosticAttempt(id: string): Promise<DiagnosticAttempt>;
  submitDiagnostic(id: string, answers: DiagnosticAnswers): Promise<DiagnosticAttempt>;
};
```

`DiagnosticBlueprint` has `id`, `definition`, `draft_revision`, `latest_version`, `preview`, `preview_warnings`. `DiagnosticVersion` has `id`, `blueprint_id`, `version_number`, `draft_revision`, `class_level`, `subject`, `published_at`, `withdrawn_at`, `concept_count`, `question_count`. Lists use cards containing ID/title/class/subject/counts/latest version; only staff cards have draft revision. Candidate/preview question DTOs include private keys only in staff-only responses. Learner attempts/results follow the Shared Interface Contract exactly.

- [x] Write failing scope/storage tests:

```typescript
it('does not resume another learner or class', () => {
  const owner = { user_id: 1, organization_id: 1, class_: '8' };
  saveDiagnosticResume(owner, '00000000-0000-4000-8000-000000000001');
  expect(readDiagnosticResume({ ...owner, user_id: 2 })).toBeNull();
  expect(readDiagnosticResume({ ...owner, class_: '9' })).toBeNull();
});
```

- [x] Run `npm test -- src/lib/diagnostic-resume.test.ts` from frontend; observe missing-module failure.
- [x] Implement `saveDiagnosticResume(identity, attemptId)`, `readDiagnosticResume(identity): string|null` and `clearDiagnosticResume(identity)`. Use a `sakhi_diagnostic_attempt:` key containing exact school/user/encoded class scope. Validate stored UUID; store only attempt ID, no keys/credentials/results or unsent answers. Return null safely on corrupt/blocked storage; server GET must authorize before rendering.
- [x] Add typed wrappers through existing `apiFetch<T>`; do not change automatic write-retry policy. Creation/publish/submission intent handling belongs to callers. Add local credential-free storage and `clearDeviceData()` erasure coverage, leaving the exact public-cache preservation policy unchanged.
- [x] Run resume/device/session tests, TypeScript and lint; commit the five files with `feat: add typed diagnostic client and scoped resume`.

### Task 9: Build staff curation without enlarging the teacher dashboard

**Files:** Create `frontend/src/components/diagnostics/DiagnosticEditor.tsx`, `DiagnosticConceptEditor.tsx`, `DiagnosticEditor.test.tsx`, `DiagnosticConceptEditor.test.tsx`. The page shell/navigation lands in Task 11.
**Interfaces:** `DiagnosticEditor({identity: DiagnosticIdentity})`; child `DiagnosticConceptEditor({concept, peers, candidates, disabled, onChange})`, using the exact Task 8 DTOs. The editor uses the ten typed API helpers; preview is read-only and produces no attempt/event.

- [x] Write failing RTL tests for labelled metadata, adding/removing concepts, approved candidate selection, prerequisites, incomplete publication, stale-edit 409, read-only preview and withdrawal. Use real project children; mock API/router/session boundaries only.

Initial test uses spies on the existing API boundary, with no mocked project child:

```typescript
it('keeps publication disabled for an empty concept graph', async () => {
  vi.spyOn(api, 'listDiagnosticBlueprints').mockResolvedValue({ blueprints: [], next_after_id: null });
  render(<DiagnosticEditor identity={{ user_id: 3, organization_id: 1, class_: '8' }} />);
  expect(await screen.findByRole('heading', { name: /assessment setup/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /publish assessment/i })).toBeDisabled();
});
```
- [x] Run `npm test -- src/components/diagnostics/DiagnosticEditor.test.tsx src/components/diagnostics/DiagnosticConceptEditor.test.tsx` before implementation.
- [x] Build a separate editor with stable creation UUID per draft intent, save-before-publish using the returned revision, pagination controls for candidates, explicit “Staff preview” and “Publish assessment”/“Withdraw version” buttons. A stale save preserves local edits and offers reload; it never silently overwrites. Mutations disable competing actions and ignore responses after identity/unmount changes.
- [x] Use labelled concept-ID/label fields and checkbox prerequisite controls; block removing a referenced concept until its edges are removed. Explain exactly three selected questions and show current selection count. Render validation/errors as text, not color only. A preview reads already-authorized staff data and never calls start/submit.
- [x] Test a renamed/removed concept with dangling edges, Unicode/long labels, empty candidates, later candidate pages, changed school/account, failed publication and identical publish recovery. Verify the child file before parent integration and keep each component focused.
- [x] Run both files, lint and types; commit only these four files with `feat: add school diagnostic curation editor`.

### Task 10: Build the learner assessment and server-evidence result

**Files:** Create `frontend/src/components/diagnostics/DiagnosticAssessment.tsx`, `DiagnosticResult.tsx`, `DiagnosticAssessment.test.tsx`, `DiagnosticResult.test.tsx`.
**Interfaces:** `DiagnosticAssessment({identity: DiagnosticIdentity})`; `DiagnosticResult({result: DiagnosticResult; concepts: DiagnosticAttempt['concepts']})`. Imports use a type alias if needed to avoid component/type name collision.

- [x] Write failing tests for empty/error/reload states, active resume, explicit skip, frozen uncertain submission and completed result focus. Submit must require all question keys; undefined is not null.

The first result test is standalone, so its real result component is verified before assessment integration:

```typescript
it('reports skipped coverage without claiming mastery', () => {
  const result: DiagnosticEvidenceResult = {
    correct_count: 0, answered_count: 0, question_count: 3, skipped_count: 3,
    concept_results: [{ id: 'base', label: 'Foundations', correct_count: 0, answered_count: 0,
      question_count: 3, skipped_count: 3, state: 'insufficient_evidence',
      review_prerequisites: [], unassessed_prerequisites: [] }],
    items: [], next_action: { kind: 'collect_evidence', concept_id: 'base',
      reason: 'No questions answered for Foundations.', href: '/practice' },
    limitations: 'Tentative evidence, not proof of mastery.',
  };
  render(<DiagnosticResult result={result} concepts={[]} />);
  expect(screen.getByText(/insufficient evidence/i)).toBeInTheDocument();
  expect(screen.getByText(/3 skipped/i)).toBeInTheDocument();
  expect(screen.getByText(/not proof of mastery/i)).toBeInTheDocument();
});
```

Import `DiagnosticResult` DTO as `DiagnosticEvidenceResult` in this test/component to avoid its component-name collision. Provide explicit imports of `render`, `screen`, `it`, `expect`, API spies and components in their test modules.
- [x] Run `npm test -- src/components/diagnostics/DiagnosticAssessment.test.tsx src/components/diagnostics/DiagnosticResult.test.tsx` before implementation.
- [x] Key assessment state by user/school/class. Load the server-authorized stored attempt or list, keep a UUID for each in-page creation intent, and save the returned attempt ID. Use fieldset/legend and labelled radio options plus “I'm not sure”; build a strict ID-to-index/null payload. Freeze the submitted map for identical retry; no local score or alternate evaluator.
- [x] Distinguish 401/403, missing 404, recalled/stale 409, validation 422 and transient network failures. Missing/recalled references are cleared with an explained return to list; a completed response lost before reload is recovered through GET. If a changed-answer 409 reveals an already-completed attempt, fetch/show the authoritative stored result with an explicit notice, not a silent overwrite.
- [x] Render count-based evidence states, skipped coverage, separate prerequisite reasons and the deterministic next step. Focus the result heading; show the school-defined/tentative/repeated-question notices and practice link. Clear the old reference on explicit new attempt; do not persist unsent choices or queue offline writes.
- [x] Add commit-before-response-loss resume, all-skip/no-zero-division, mixed counts, all-strength spaced practice, account/class switch, stale callback, radio keyboard and focus tests. Verify result component first, then integrate into assessment.
- [x] Run focused tests, lint and types; commit only these four files with `feat: add diagnostic assessment and explained evidence UI`.

### Task 11: Integrate authenticated pages and responsive navigation

**Files:** Create `frontend/src/app/diagnostics/page.tsx`, `frontend/src/app/teacher/diagnostics/page.tsx`, `frontend/src/app/diagnostics/page.test.tsx`; modify `frontend/src/components/Sidebar.tsx`, `frontend/src/app/globals.css`.
**Interfaces:** Student page allows `['student']`; staff page allows `['teacher','admin']` through constant role arrays and `useRequireAuth`. Construct diagnostic identity only after session readiness and non-null school; render a clear school-required state otherwise.

- [x] Write failing page tests for anonymous redirect, adult/student denial, unready session, missing school and own identity passed to the real assessment. Test the new navigation links through the real sidebar in the new page test, using the actual AccessibilityProvider and mocked API/router/session boundaries; do not add another file to this task.

```typescript
const readyStudentContext: ReturnType<typeof userContext.useUser> = {
  user: { user_id: 1, name: 'Synthetic learner', class_: '8', language: 'English',
    weak_subject: 'Math', role: 'student', organization_id: 1 },
  auth: { user_id: 1, expires_at: '2030-01-01', token_type: 'Cookie' },
  sessionId: 'diagnostic-test', isReady: true,
  setUser: vi.fn(), refreshUser: vi.fn().mockResolvedValue(undefined),
  updateProfile: vi.fn().mockResolvedValue(null), clearUser: vi.fn().mockResolvedValue(undefined),
};

it('shows the school requirement without starting an assessment', async () => {
  vi.spyOn(userContext, 'useUser').mockReturnValue({ ...readyStudentContext,
    user: { ...readyStudentContext.user!, organization_id: undefined } });
  const start = vi.spyOn(api, 'startDiagnostic');
  render(<AccessibilityProvider><DiagnosticsPage /></AccessibilityProvider>);
  expect(await screen.findByRole('status')).toHaveTextContent(/school account required/i);
  expect(start).not.toHaveBeenCalled();
});
```

The fixture uses the actual exported hook's return type because the internal `UserContextValue` type is not exported. Stub router navigation and restore mocks between cases; do not use an `any` cast or omit required session fields.
- [x] Run the new page file and affected sidebar tests before integration.
- [x] Add thin page shells with one h1/main landmark, existing Sidebar and the focused components. Add “Diagnostics” learner navigation and “Diagnostic editor” staff navigation, without changing existing teacher-dashboard tabs. Mobile content reserves the menu area and uses an explicit vertical scroll region.
- [x] Add scoped diagnostic CSS using existing tokens; make controls at least 44px high on mobile, bound grids/selects/text, support wrapping, visible focus and reduced motion. Do not rewrite unrelated global themes.
- [x] Run page/sidebar/diagnostic component tests, full frontend tests, lint/types/build; commit only this task's actual changes with `feat: integrate responsive diagnostic pages`.

### Task 12: Verify the complete workflow and record exact coverage

**Files:** Modify `tests/e2e/sakhi.spec.cjs`, `tests/e2e/sakhi.md`, `docs/browser-testing.md`; create `docs/diagnostics.md`, `docs/verification-diagnostics.md`. Update the overall tracker after evidence, without claiming other phases complete.
**Interfaces:** Reuse `BasePage`, installed runtime/Edge, loopback 8100/3101 fixture, real cookie proxy and condition-based locators. Do not download the previously security-review-blocked browser CLI.

- [x] Add actual UI journeys after the existing practice case so the new bank content does not break its one-question precondition. Create six Math/class-8 questions in a distinct diagnostic chapter, approve them, curate a two-concept chain and publish it through the editor. No live school or direct fixture mutation substitutes for the user-facing curation flow.

Start the new browser case with the existing fixture/page-object boundaries and finish with user-visible publication state:

```javascript
test('staff publication enables private diagnostic evidence and recall handling', { timeout: 180000 }, async () => {
  await journey('Teacher', async (app, page) => {
    await app.goto('/teacher/diagnostics');
    await app.heading(/diagnostic editor/i);
    await expect(page.getByRole('textbox', { name: /assessment title/i })).toBeVisible();
  });
});
```

Expand this same case through the explicit authoring/student/withdrawal steps below; this initial smoke assertion alone is not diagnostic acceptance. Explore real editor labels before fixing its final selectors, and use locator/response conditions rather than fixed sleeps.
- [x] Learner journey selects the publication, reloads to resume, submits a mix of wrong/correct/skip answers and verifies exact counts/prerequisite reasons, server result focus and key-free active payload. Check 320/768/1024/1440px bounds, scroll and keyboard controls. Logout/login as classmate must show no prior attempt/result.
- [x] Start a separate pending attempt, withdraw its version through staff UI, then verify visible learner denial. Completed historical result still loads. A new list does not reactivate an older version. Keep expected deliberate errors recorded; unexpected console/page errors fail normal journeys.
- [x] Use fresh temporary backend state and a freshly built standalone frontend. Run `python -m pytest -p no:cacheprovider --tb=short --show-capture=no`, Ruff/format, `python evals/run_evals.py`, full frontend tests/lint/build and `node --test tests/e2e/sakhi.spec.cjs` with the environment in `docs/browser-testing.md`. Inspect mobile/result/withdrawal screenshots, not only DOM assertions.
- [x] Record red/green reproductions, exact pass/failure/skip counts, browser/runtime versions, console evidence, commands and untested coverage. Refresh dependency audit status separately; never call an inconclusive/global scan a clean project audit. Do not reuse the October 12 test totals as new evidence.
- [x] Publish contract/authoring/resume/privacy limits in `docs/diagnostics.md`; mark task 9 accepted only after every spec acceptance item maps to passing evidence. Keep task 10 and measured-learning-gain checkpoints open. Review the full feature diff, then commit only the feature verification/doc changes with `test: verify school diagnostic workflow end to end`.

## Spec Coverage and Handoff

Teacher workflow/graph rules: Tasks 1–4, 9. Student workflow/scoring: Tasks 2, 5, 8, 10. Storage/versioning/retries: Tasks 3–5. HTTP/security: Task 6. Privacy: Task 7. Accessibility/mobile: Tasks 9–12. Verification and existing-behavior preservation: every task plus Task 12. Each Review Focus item has an owning test step above.

The repository has substantial pre-existing changes. The executor must inspect staged and unstaged scope before each commit; the illustrated messages are not permission to include unrelated edits. No deployment or live migration follows from this plan.

Recommended execution method: **Native**, because these twelve tasks share one tightly coupled snapshot/DTO contract and the existing working tree is already shared. Implement sequentially, with focused red/green checks and a final independent feature review; use the executing-plans skill after the owner reviews this plan and selects the execution method. Subagent-driven is an available, more review-intensive alternative if explicitly selected.
