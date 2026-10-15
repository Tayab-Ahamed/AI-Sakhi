# AI Sakhi implementation plan

October 15 diagnostic execution checkpoint: the approved twelve-task Native implementation and independent-review fix pass are accepted, with 247 backend / 145 frontend / 11 synthetic browser cases plus lint/types/build/Ruff/reference graders. The owner subsequently requested a push of the current work before remaining phases; the source checkpoint includes the previously uncommitted integration foundation. See `docs/verification-diagnostics.md` and `docs/push-checkpoint-2026-10-15.md`. Infrastructure, owner-policy, broader accessibility and measured-learning-gain phases remain open.

Approved scope: the user requested implementation of the October 6 audit on October 7, 2026. Work proceeds in dependency order with verification after each slice. Tasks are tracked in `tasks/todo.md`.

## Decisions

- Protect learner records before introducing new experiences. Browser sessions use HttpOnly cookies through a same-origin API proxy; bearer tokens remain available for explicit API clients.
- Make route authentication explicit and check resource ownership against trusted identity. Organization administrators are scoped to their organization; there is no implicit global administrator role.
- Keep the existing database intact during implementation. Schema changes are forward migrations; tests use temporary databases. PostgreSQL migration requires a rehearsed export/import and restore before cutover.
- Cache public assets only in the service worker. Learning content belongs in a user-scoped local store with deterministic cache keys and explicit logout erasure.
- Separate transport, policy, and persistence into focused modules. Introduce infrastructure only when it has an exercised local workflow and tests.
- Existing production data and external services are not deployed or migrated by this implementation. Infrastructure configurations and migration tools must be reviewable first.

## Threat boundaries

Untrusted HTTP identifiers, uploaded content, model responses, shared browser caches, school joins and invitations cross into credentials, child records, assessments, safeguarding events, and administrator actions. Tests must cover impersonation, organization leakage, cached data after logout, duplicated writes, and malformed model output.

## Ordered work

1. Route policy and resource isolation; API integration tests.
2. Cookie sessions, same-origin proxy, session management and CSRF; shared-device cache isolation.
3. Privacy export/request fulfilment and safeguarding review; consent/retention controls.
4. Continuous lint, integration, frontend and AI evaluation gates; supply-chain checks.
5. Domain routers/services and reusable frontend components; accessibility and mobile journeys.
6. Diagnostic assessment, concept prerequisites, mastery-based recommendations, hint ladders and teacher-approved questions.
7. PostgreSQL migration and Redis-backed limits/jobs; private uploads, idempotency, restore/load tests.
8. Voice, multimodal feedback, learning packs, localization, institutional integrations and operational rollout controls.

## Acceptance and checkpoints

Every task must have focused abuse/behavior tests where applicable, clean lint/type checks, and recorded evidence before it is checked off. Public route allowlists and role/resource contracts must cover every API method. Infrastructure, live-model performance and browser claims require actual runs; configuration alone is not verification.

## External decisions

## Remaining-roadmap execution request

October 15: the owner approved the school-curated diagnostic specification, twelve-task plan and Native sequential execution with independent final review. That diagnostic slice is now accepted: 247 backend / 145 frontend / 11 real Edge cases, lint/types/build/Ruff/reference graders pass; original review's two Important recovery gaps fixed with observed RED→GREEN regressions. Two minors and dependency release gates remain. Schema 10 was exercised only on temporary databases. The diagnostic-only commit range omitted preserved baseline integrations; the subsequent owner-requested source push checkpoint includes those files. See `docs/verification-diagnostics.md`. This is not completion of all remaining phases.

Remaining program order after diagnostic acceptance: (1) resolve dependency gates and broaden role/accessibility/contract coverage while completing focused domain decomposition; (2) task 10 learning-event/intervention integration, then task 11 hint/remediation and task 12 rubrics/resubmission/digest opt-in; (3) PostgreSQL parity/restore before Redis/shared jobs, private uploads and general retry/offline conflicts; (4) load/restore/image-scan/staged-release rehearsals; (5) voice/multimodal/citations and low-bandwidth/localization/portfolios; (6) chosen SSO/roster/LMS sandbox adapters. These are separately reviewable subsystems, not silently included in the diagnostic specification. Existing tasks stay open until their own acceptance evidence is recorded.

Owner-dependent release boundaries remain: published policy and verified school/guardian relationships; destructive live retention/backup expiry; production cutover and residency/provider agreements; actual learning-gain evidence; identity/LMS provider and sandbox credentials. Build and exercise provider-independent/local behavior first. No generic “implement all” request is treated as permission to provision paid services, fabricate institutional facts, delete live records or bypass release scan failures.

October 12 continuation: finish a reproducible production-build browser regression slice before advancing learning/infrastructure work. Use the preinstalled Playwright runtime and installed Edge in a fresh profile; do not download the security-review-blocked browser CLI. Acceptance: real UI login for four synthetic roles, learner navigation and unauthorized-route redirects, linked-guardian approval/learner withdrawal with server denial, governance authority display, mobile menu keyboard behavior and layout bounds. Capture screenshots and console/page errors. Keep external-provider, deletion-policy and deployment decisions pending; do not equate route smoke coverage with all feature acceptance.

October 12 next vertical slice (partial tasks 8/11/16): extend the existing teacher question bank into learner practice without external AI. Separate route/contracts from the transactional practice service. Only approved, valid MCQs in the learner's current school/class may be served; never expose answer keys before completion (including privacy export). The server owns question snapshots and grades option indices. Creation intents are stable across retries, mismatched reuse conflicts, and submission/progress commit atomically once. Show teacher explanations after completion and reflect scores through existing progress/mastery. Cover role/tenant/class abuse, malformed input, revoked questions, concurrent retries, privacy lifecycle, component behavior and actual browser completion. This is not the full diagnostic/prerequisite graph or validated learning-gain phase; those remain separately tracked.

October 12 result: the contained reviewed-practice and browser slices passed their recorded acceptance checks. Traditional approved-bank practice is independent of a diagnostic graph, so this subset was implemented without marking tasks 9–11 complete. The final browser suite adds deterministic first-worker activation, ten fresh-profile logins, mobile scrolling and public-only offline/reconnect/logout checks. See `docs/verification-2026-10-12.md` for 126 backend / 82 frontend / 9 browser results and unresolved dependency scans. The next learning slice must define curated prerequisite edges, diagnostic coverage and uncertainty explicitly; current practice scores must not be marketed as validated diagnosis or measured learning gain.

October 8: the owner requests completion of remaining phases and detailed browser testing. Preserve the incomplete tracker rather than resetting it. The prior high-level roadmap is not an executable brief for the executing-plans automation; use planning-and-task-breakdown to refine vertical slices in place. No blanket production deployment, paid provisioning, real student approvals or permanent live-data deletion is inferred.

October 8 selected slice (verified in the October 12 record): extend the approval panel to linked-parent / school-staff subjects, select subjects only from existing authorized children/roster responses, and connect it to parent/governance pages. Acceptance: selected authority has acknowledgement/approve/withdraw controls, other authority has read-only status, policy changes reset acknowledgement, and subject changes cannot show stale data. Verify panel tests before integration tests, then lint/types/build.

Browser verification: launch a loopback-only backend with a fresh temporary SQLite/Chroma path, synthetic role accounts and no real provider key; launch frontend on a separate local port through the real same-origin proxy. Exercise real UI login, authenticated role navigation, approval states, logout/reload and denied access. Record observed results versus untested journeys; do not label page loads an exhaustive feature test. Chrome DevTools is unavailable; the October 12 run uses preinstalled Playwright and installed Edge, with console/screenshots and viewport checks. State unavailable physical-device, live-model and full accessibility measurements.

Subsequent slices retain tasks 6–20 and their existing dependencies. PostgreSQL/Redis/scan/restore acceptance needs actual local services; institutional integration needs a provider/roster contract. Published legal policy, verified guardian links and learning-gain claims cannot be supplied by synthetic fixtures.

## October 8 consent/retention slice

Start task 5 with versioned, school-scoped AI approval records, configurable guardian/school approval authority, and server-side processing gates. Development remains explicitly unconfigured until the owner chooses a policy; production AI calls fail closed without that choice. Withdrawal must not undo a separate processing restriction. Export/erasure must cover the new records. Add an administrator-only, read-only chat-retention preview with a disabled default, UTC cutoffs and no transcript payloads. No automatic deletion, production database changes or legal-compliance claim is authorized by this slice. Acceptance: isolated tests for approval authority, school changes, policy changes, withdrawal, restriction and preview boundaries. Add the own-account approval panel on the privacy page; test the panel first, then its page integration. Guardian/staff roster approval UI and destructive retention execution remain follow-up work.

The owner chose a free setup for now (October 7): keep the target local/self-hosted and do not provision paid cloud services. No identity/LMS provider has been selected.

Deployment host, residency, identity provider, verified school roster, provider agreements, legal policies, emergency protocols and real notification recipients require owner-provided settings. Engineering supports configuration and enforcement but cannot invent those facts. Do not label the product compliant or production-ready based on scaffolded controls.
