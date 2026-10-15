# School-curated diagnostics and prerequisite guidance

Date: October 15, 2026 (Asia/Calcutta).
Status: written specification and twelve-task Native execution approved by the user on October 15, 2026. Diagnostic implementation accepted after engineering/browser gates, original independent review and one TDD fix pass. See `docs/verification-diagnostics.md` for evidence, deferred minors and uncommitted-integration/release limits; this is not whole-roadmap or production acceptance.
Roadmap: task 9, with a narrow explained-next-step result. This does not complete task 10's integration across mastery, recommendations, sprints and recall.

## Objective and agreed intent

Give students a short, school-reviewed assessment that identifies where to gather more evidence or practise next. Teachers define the concepts, prerequisite relationships and approved questions. Students see the evidence and the reason for each suggestion, not an unsupported claim of mastery or a validated diagnosis.

The owner requested completion of the existing roadmap, selected a free/local setup for now and approved school-curated diagnostics rather than a single-subject pilot. This specification covers one capability: the teacher-to-student diagnostic workflow. Graph validation and scoring are internal parts of that workflow, not a new general-purpose curriculum platform.

Assumptions for review:

- Keep the existing Next.js/React frontend, FastAPI/Pydantic backend, SQLite migration lifecycle and same-origin cookie/CSRF proxy. No new runtime dependency or paid service is needed.
- Active teachers and school administrators may curate assessments within their own school. Students take only assessments for their current school and class.
- No initial prerequisite relationships or question mappings are invented from chapter order. Schools supply and review their content; an unconfigured school sees an honest empty state.
- Assessment evidence remains separate from legacy topic/mastery scores in this phase. Integration and any confidence calibration require the later learning-loop phase.

Repository baseline: Next.js 16.4.0, React/React DOM 19.2.4, FastAPI `>=0.115,<1` and Pydantic `>=2.9,<3`. Keep these existing contracts; this design is not a framework/dependency upgrade.

## Scope

Included: staff draft editing, graph validation, approved-question selection, publication/withdrawal, a student assessment page, server-owned scoring, conservative per-concept evidence, explained prerequisite guidance, safe retries, privacy lifecycle and actual browser verification.

Excluded: AI-generated questions/graphs, inferred misconceptions from free text, adaptive item selection, statistical or clinical diagnostic validation, certified curriculum alignment, automatic mastery updates, parent result dashboards, email/digests, general graph APIs, offline assessment submission, PostgreSQL/Redis deployment, SSO/LMS integration and live production migration.

## Decision and alternatives

Use school-curated, versioned assessment blueprints. Each published version contains its own small concept graph and reviewed question snapshots. This preserves the content against which an attempt was scored and makes teacher changes explicit.

A centrally maintained single-subject pilot would need less initial authoring but would narrow the existing multi-class product and require an independently reviewed seed curriculum. It is not selected. AI-assisted graph generation would add provider use and content-review obligations without removing school review; it is outside this phase.

Consequences: schools must configure content before students can use diagnostics; historical evidence is tied to a specific version; results remain tentative; existing practice stays available independently. This design records the architectural decision without duplicating the same rationale in a separate ADR.

## Teacher workflow

1. Open a dedicated diagnostics editor linked from the teacher/admin navigation. List only the current school's blueprints, with separate draft revision and published-version status.
2. Create a draft with a title (1–120 characters), class (1–20) and subject (1–100). Subject is an exact school-bank subject value; no implicit aliasing of “Math” and “Mathematics”.
3. Add up to six concepts, with local IDs, labels, prerequisite selections and question selections. A draft may be incomplete but must be structurally valid. Save uses an expected draft revision; stale editors receive 409 and must reload, not overwrite silently.
4. Publish only when there are 1–6 concepts and exactly three distinct, valid, approved MCQs per concept. A question cannot belong to two concepts in the same blueprint. Every selected question must match school, class and subject. Maximum assessment length is 18 questions.
5. Publication creates an immutable content version, records the reviewer and timestamp, and leaves the draft available for a later revision. Retrying publication for the same draft revision returns the same published version.
6. Withdraw a published version to stop new starts and block unfinished attempts using it. Completed results remain historical. Withdrawal is terminal for that version; republishing requires a new draft revision/version.

Staff preview is clearly labelled as a preview and cannot create student results or learning events. A teacher may publish their own blueprint, matching the existing school question-review authority; independent second-reviewer approval is not claimed.

## Graph and question rules

- Concept IDs are unique within a blueprint and match `^[a-z][a-z0-9-]{0,39}$`; labels contain 1–80 trimmed characters. Each concept may reference only other concepts in that blueprint.
- Reject duplicate prerequisite edges, self-reference, unknown IDs and cycles. Return actionable validation messages without leaking another school's resources.
- Prerequisites mean “this school suggests reviewing A before B”, not a scientifically established dependency. UI copy makes that distinction clear.
- Stable topological order breaks ties by the teacher's saved concept order. Question order follows that concept order and the teacher's saved selection order.
- Use the existing reviewed-MCQ interpretation: 2–10 distinct, nonblank options; a valid letter key takes precedence over an exact option-value key. Enforce a maximum 1,000 characters per option, 5,000 for question text and 5,000 for explanation in diagnostic eligibility, including historical records.
- Bound database reads and response sizes before loading candidate content. Staff question selection is filtered by school/class/subject, paginated with a maximum page size of 100, and does not scan an unbounded bank into memory.
- Snapshot question IDs, text, options, correct index and explanation at publication. Learner payloads exclude correct indices and explanations until that learner completes the attempt.
- Before a new start, unfinished read or submission, verify that referenced questions remain approved and their diagnostic content still matches the published snapshot. Recall or content changes require staff revision/republishing; they must not silently change a learner's key.

## Student workflow

1. Open `/diagnostics` and see only currently published blueprints matching the authenticated school's current class. No account/school/class identifiers are accepted from the browser as authority.
2. Choose a blueprint, view its concept and question counts and read the notice: a short assessment gives tentative evidence, not proof of mastery. A repeat may reuse the same questions and is not independent evidence of improvement.
3. Start against the displayed version with a UUID creation key. A stale latest-version selection receives 409 and a reload action. Store the attempt ID under account, school and class scope, never a credential or answer key, so an online reload can resume it after server authorization.
4. Answer each question or explicitly choose “I'm not sure”. Only a selected option or an explicit null/skip is submit-ready. Selections not yet submitted remain in memory; a reload can resume the attempt but does not promise restoration of unsent selections.
5. Submit the full question-ID map once. Freeze selections during uncertain delivery and allow an identical retry. Do not generate local scores, silently change answers, or fall back to another grading endpoint.
6. Show totals, per-concept evidence, teacher explanations and prerequisite reasons. Move keyboard focus to the result heading. Provide a link to school practice and a clearly separate new-attempt action.

Online resume validates the attempt before showing any content. Logout, session revocation or account switching erases its device reference. A missing/withdrawn/recalled attempt offers a clear explanation and a return to the current list, not a retry loop with the same invalid intent. Offline mode offers reconnection; diagnostics are not cached by the service worker or queued for later submission.

## Scoring and explained next steps

The server grades indices against the published snapshot. A null selection is skipped, not incorrect. Return `correct_count`, `answered_count`, `question_count` and `skipped_count`; do not divide by zero or hide skipped coverage inside an accuracy percentage.

Each concept has exactly three assigned questions. Use these explicit, provisional product rules:

| Evidence in this attempt | State | Meaning shown to the learner |
| --- | --- | --- |
| Fewer than three answered | `insufficient_evidence` | Answer more reviewed questions before drawing a conclusion. |
| Three answered, zero or one correct | `review_suggested` | These answers suggest revisiting the concept. |
| Three answered, two or three correct | `provisional_strength` | Encouraging evidence in this short attempt, not confirmed mastery. |

These thresholds are design heuristics, not a validated educational standard. All result states carry a tentative-evidence notice. Previous attempts and legacy progress do not increase the diagnostic's confidence.

For every concept, return the IDs/labels of all ancestor prerequisites in `review_suggested` and `insufficient_evidence`, separately. No ancestors means no prerequisite evidence is required. Do not block access to harder learning content or label the learner incapable.

Choose the first concept in stable topological order that is not `provisional_strength`: suggest collecting evidence if insufficient, otherwise reviewing it. Return the exact answered/correct counts and school-defined prerequisite relationship behind the suggestion. If all concepts show provisional strength, recommend spaced practice and explicitly avoid “all mastered”. No inferred misconception label is produced.

## Persistence and transactional behavior

Use forward-only migrations, tested on temporary databases. The implementation plan must record the actual next migration version after rechecking the repository; do not reserve a version by editing the live database.

- `diagnostic_blueprints`: server ID, organization, creator, bounded draft definition, draft revision, creation intent and timestamps. Unique creation intent within school/creator recovers duplicate create requests; mismatched reuse conflicts.
- `diagnostic_versions`: server ID, blueprint/school/class/subject, version number, draft revision, immutable private definition/question snapshot, publisher, publication time and withdrawal metadata. Unique `(blueprint_id, draft_revision)` prevents duplicate publication. Content cannot be edited in place.
- `diagnostic_attempts`: UUID, user/school/class, published version, creation key, active/completed status, submitted answer map, stored result, creation/submission timestamps. Unique `(user_id, creation_key)` prevents duplicate starts.

Store content graphs as bounded, validated JSON within a version; they have no consumers outside diagnostics in this phase. A separate normalized/global concept catalog would be premature. Database constraints and scoped joins must prevent orphan/mismatched references.

Create/publish/withdraw/submit execute in short SQLite transactions. Submission atomically stores answers/result/completion and one `diagnostic_completed` learning event. It does not insert a legacy progress/mastery row. Identical retries return the stored result; different answers after completion return 409. A failure after scoring leaves no partial completion/event.

Only the latest published version may start a new attempt, and only while it is not withdrawn. Do not fall back to an earlier version when the latest is withdrawn. Existing attempts on superseded, non-withdrawn versions may finish if their questions remain eligible. Current class/school changes invalidate access to old attempts; completed results are historical only within the original eligible scope.

## HTTP boundary

All routes are new and use explicit authentication dependencies plus live role/resource checks. Browser requests use the existing cookie/CSRF proxy. Extra fields are forbidden; IDs are validated; numeric answer indices are strict integers, never booleans or numeric strings. Bodies never accept caller-controlled score, key, owner or organization authority.

| Route | Authority and contract |
| --- | --- |
| `GET /v2/diagnostics/blueprints` | Staff: own-school drafts/version metadata; student: eligible latest publication metadata only. Paginated, page size at most 100. Other roles: 403. |
| `POST /v2/diagnostics/blueprints` | Staff creates a draft using UUID creation key, title, class and subject; 201, stable identical replay. |
| `GET /v2/diagnostics/blueprints/{id}` | Staff only, own-school draft and revision. |
| `PUT /v2/diagnostics/blueprints/{id}` | Staff replaces the bounded draft using `expected_revision`; 409 on conflict. |
| `GET /v2/diagnostics/blueprints/{id}/questions` | Staff only, eligible paginated question candidates with bounded text/options; class/subject come from the draft. |
| `POST /v2/diagnostics/blueprints/{id}/publish` | Staff, `expected_revision`; validates coverage, graph and current question status; 201/stable replay. |
| `POST /v2/diagnostics/versions/{id}/withdraw` | Staff, own school; idempotent withdrawal, 200. |
| `POST /v2/diagnostics/attempts` | Student, `creation_key` and displayed `version_id`; 201/stable replay. |
| `GET /v2/diagnostics/attempts/{uuid}` | Owning active student only, current school/class; public attempt or own completed result. |
| `POST /v2/diagnostics/attempts/{uuid}/submission` | Owning student, exact question-ID map to index/null; returns stored server result, 200. |

Unauthenticated: 401. Wrong role: 403. Unknown or cross-school/cross-user resource: indistinguishable 404. Stale revision/version, recalled/changed content or changed retry intent: 409. Invalid graph/coverage/input: 422 with bounded field-level messages. Do not echo answer keys in errors. Existing rate limits apply; bounded schemas are not a substitute for rate limits.

## Privacy, security and accessibility

- Reuse current identity and school scope, not a parallel authentication system. No student/staff impersonation or new implicit global-admin exception.
- Export owned attempts/results, stripping pending keys from snapshots. Include staff-authored blueprint data only under the existing own-account author-export policy. Student export must never disclose staff-only keys through a referenced version.
- Active-database erasure removes owned attempts/events/device references and anonymizes authorship where other learners' historical evidence requires retention. A deleted publisher's ID must not break completed results. Unpublished creator-owned drafts with no historical consumers may be deleted. Apply the existing safeguarding and backup-limit disclosures; do not claim complete backup/provider erasure.
- Do not collect new sensitive profile fields or send diagnostic content/results to an AI provider. Do not log answers, keys, credential values or full learner result payloads.
- Use semantic forms, fieldset/legend for question groups, labelled radio choices including skip, keyboard-operable concept/prerequisite controls, announced loading/errors and visible focus. Do not communicate states by color alone.
- Test 320/768/1024/1440px layouts, mobile-menu clearance, long content, scrolling and reduced motion. Do not claim full WCAG or physical-device certification from these checks.

## Implementation boundaries and source locations

Backend: focused `backend/diagnostic_routes.py`, `backend/diagnostic_service.py` and a pure `backend/diagnostic_rules.py`; wire the router through the existing main application. Migration/privacy changes stay in their canonical modules. Reuse reviewed-MCQ validation through a small shared helper only if its existing behavior remains covered; do not couple the two transactional services or grow the main router with diagnostic business logic.

Frontend: `/diagnostics` and `/teacher/diagnostics` use dedicated learner/editor components, typed client contracts and existing auth/sidebar/UI conventions. Administrator navigation may link to the same staff editor under its role check. Keep components focused; do not add a large editor to the existing teacher dashboard file. Reuse the current visual tokens and read bundled Next.js guides before implementation.

Tests: pure graph/scoring tests and isolated HTTP/database tests under `backend/tests`; Vitest/RTL tests next to new components; maintained browser journeys in `tests/e2e/sakhi.spec.cjs`. Design/verification evidence remains in `docs`; execution tasks extend `tasks/plan.md` and `tasks/todo.md` without replacing open work.

Use snake_case and Ruff for Python, PascalCase React components and strict TypeScript contracts. Match the existing route/service boundary, for example:

```python
def read_attempt(conn, identity, attempt_id):
    row = _load_attempt(conn, identity, attempt_id)
    _check_pending_questions(conn, identity, row)
    return public_attempt(row)
```

This example is from current reviewed practice: authorize first, check pending-content eligibility, then return an allowlisted payload. Diagnostic-specific rules remain in the diagnostic domain.

Always: preserve unrelated work, validate trusted scope, use parameterized queries, write regression tests first, verify negative paths and report exact results.
Ask first: changes to this design's scope/schema strategy, new dependencies or paid/external services, production migrations, destructive live operations or changes to published owner policies.
Never: commit secrets, modify vendor files, remove failing tests to obtain a pass, invent school approval/content, publish legal/learning-validity certifications or deploy by implication.

## Verification commands and acceptance

Commands below are future implementation gates, not results achieved by writing this specification. Run from the repository root unless stated otherwise:

```powershell
python -m pytest -p no:cacheprovider --tb=short --show-capture=no
python -m ruff check backend scripts tests evals
python -m ruff format --check backend scripts tests evals
python evals/run_evals.py
```

From `frontend`: `npm test`, `npm run lint`, then `$env:BACKEND_URL='http://127.0.0.1:8100'; npm run build`. For synthetic runtime startup and installed-browser environment, follow `docs/browser-testing.md`; then run `node --test tests/e2e/sakhi.spec.cjs` from the root. Never use a live school as the fixture.

Acceptance criteria:

1. Staff can create/save/publish/withdraw a bounded blueprint; invalid graphs, inadequate coverage, stale edits, invalid/historical MCQs and cross-school/class references are rejected without key leaks.
2. A student can start/resume/submit only an eligible own attempt. Partial, all-skip, mixed and fully correct evidence produce the specified counts/states/reasons. Recalled/changed/withdrawn content is blocked before completion; completed historical results remain stable.
3. Four concurrent identical create/publish/submit requests create one logical record/event, and mismatched reuse conflicts. An injected transactional failure rolls back all submission changes. GETs do not create learning evidence or mastery snapshots.
4. Two-school, cross-user, adult/student-role, class-change, deactivation, session/CSRF, privacy export/erasure and shared-device tests pass. Pending keys are absent in all learner/export/error paths. No model-generating endpoint is called.
5. Component tests cover editor conflicts, empty/error/reload states, skip semantics, loading, frozen identical retry, account changes and focus. The real synthetic browser completes staff publication, student evidence/guidance, withdrawal denial, mobile/keyboard interaction, online resume and logout isolation.
6. Existing practice, governance, login/offline and grading tests remain green. Fresh lint/types/build/graders and browser evidence are recorded. Dependency advisories remain separate release gates and cannot be waived by a passing diagnostic suite.

## Review and rollout boundary

Self-review must check graph direction/cycles, skipped-answer semantics, privacy/key disclosure, old-version behavior, repeat evidence and the absence of implicit mastery claims. The written specification needs owner review before a task-level implementation plan is produced; that plan then needs review and execution-method selection before product code changes.

There is no unanswered content choice needed to implement the engine: schools author their own blueprints, and no seeded assessment is exposed by default. Real curriculum validation, guardian relationships, published policy, backup retention, deployment configuration and existing dependency remediation remain owner/release responsibilities. Synthetic fixtures can verify engineering behavior but cannot satisfy those real-world approvals.
