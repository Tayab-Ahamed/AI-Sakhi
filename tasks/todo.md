# Implementation tracker

Status: broader roadmap implementation in progress; the diagnostic slice is accepted. Checked items require recorded passing verification. Current diagnostic evidence: [October 15 verification](../docs/verification-diagnostics.md); earlier foundation evidence: [October 12 verification](../docs/verification-2026-10-12.md). Historical checkpoints below are not the current completion claim.

- [x] 1. Authenticate all protected routes with explicit dependencies and enforce school/resource scope. Route audit and adversarial API tests pass. Dependencies: none.
- [x] 2. Move browser sessions to cookies through same-origin proxy; support restore/logout/session revocation; remove cached credentials. Backend cookie/CSRF and frontend storage/proxy tests pass. Dependencies: 1.
- [x] 3. Replace service-worker API caching with asset allowlist; partition quizzes and erase local data on logout. Cross-user quiz and IndexedDB erasure tests pass; service-worker policy inspected. Full browser offline journeys remain in task 7. Dependencies: 2.
- [x] Checkpoint A: security regression suite, lint, types, frontend tests/build. See verification record below; dependency scans are separate release blockers.
- [x] 4. Implement active-database export, deletion/restriction fulfilment and safeguarding acknowledgement. Temporary-database lifecycle and tenant tests pass. Backup expiry remains an explicit operator obligation, tracked as awaiting_backup_expiry; not complete erasure. Dependencies: 1.
- [ ] 5. Add consent/retention policy enforcement and operational/privacy pages. Verify consent gating and retention dry-run. Dependencies: 4.
  - [x] 5a. Versioned approval API, current guardian/school authority checks, AI entry gates, withdrawal and independent processing restrictions; export/erasure includes approval records.
  - [x] 5b. Own-account approval/withdrawal panel and school-admin read-only chat-retention preview; disabled default and conservative safeguarding holds.
  - [x] 5c. Guardian/staff roster approval screens with subject/policy acknowledgement reset and read-only unauthorized authority. Isolated component tests and synthetic role browser journeys pass.
  - [ ] 5d. Operator-published policy and explicit approval/retention settings; confirmed retention execution and backup-expiry evidence. No automated deletion enabled.
- [ ] 6. Enforce Ruff, frontend lint, AI grader tests and dependency scans in CI. Verify lint, evaluations and workflow commands. Dependencies: 1–3.
- [ ] 7. Add browser journeys, accessibility, visual and contract tests. Verify desktop/mobile role journeys. Dependencies: 2–5.
  - [x] 7a. Eleven production-build synthetic browser cases: cold login/first worker install, four roles, approvals/withdrawal, navigation/redirects, governance, reviewed practice, diagnostics/staff recovery, mobile scrolling, public-only offline fallback/reconnect/logout. Screenshots and console evidence recorded.
  - [ ] 7b. Full feature acceptance, screen readers/WCAG, cross-browser/physical devices, approved visual baselines, live AI quality and complete offline learning flows.
- [ ] Checkpoint B: core user journeys and governance review.
- [ ] 8. Split backend domains and oversized frontend pages into focused services/components. Verify existing behavior and boundary tests. Dependencies: 1–7.
  - [x] 8a. New reviewed-practice router/contracts, transactional service and keyed learner component; shared canonical progress writer. Existing oversized domains/pages still require decomposition.
- [x] 9. Add school-curated diagnostic assessment and prerequisite graph. Scoring, prerequisite order, privacy, retries and actual browser recovery verified; no educational-validity claim. Dependencies: focused domain slice of 8.
  - [x] 9a. Written school-curated diagnostic specification approved by the owner on October 15. This is a design checkpoint, not implemented diagnostic functionality.
  - [x] 9b. User approved the [twelve-task diagnostic plan](../docs/superpowers/plans/2026-10-15-school-curated-diagnostics.md) and Native execution. All tasks and final review fix pass accepted: 247 backend, 145 frontend, 11 Edge cases; lint/types/build/Ruff/reference graders pass. Two minor findings and dependency release gates remain. The subsequent owner-requested source checkpoint includes the previously uncommitted integration foundation. See [diagnostic verification](../docs/verification-diagnostics.md).
- [ ] 10. Connect mastery, recommendations, sprints and recall with explainable interventions. Verify learning event progression. Dependencies: 9.
- [ ] 11. Add hint ladders, misconception remediation and approved question-bank assessment. Verify student/teacher workflow. Dependencies: 9–10.
  - [x] 11a. Provider-independent, school-reviewed MCQ practice with hidden keys, teacher explanations, progress/mastery evidence and question-recall handling. Does not implement diagnostic/prerequisite inference or hint ladders.
- [ ] 12. Expand teacher rubrics/resubmission and parent digest preferences. Verify school isolation and opt-in delivery behavior. Dependencies: 11.
- [ ] Checkpoint C: learning loop usability and measured learning gain.
- [ ] 13. Add PostgreSQL adapter and migration/restore rehearsal. Verify schema/data parity; retain original SQLite. Dependencies: 8.
- [ ] 14. Add Redis limits, shared caches, job workers and bounded AI costs. Verify concurrent requests and worker retries. Dependencies: 13.
- [ ] 15. Add private upload storage, validation/scanning, expiring access and tenant retrieval. Verify malicious and cross-school uploads. Dependencies: 14.
- [ ] 16. Add write idempotency, offline queues and conflict handling. Verify retry storms and shared-device behavior. Dependencies: 13–14.
  - [x] 16a. SQLite reviewed-practice creation intents and identical-submission recovery, atomic progress, four-way concurrent retries and rollback tests. No general/distributed idempotency or durable offline queue claim.
- [ ] 17. Add load/restore drills, deployment image scans and staged rollout controls. Verify rehearsals; no production cutover without owner settings. Dependencies: 13–16.
- [ ] 18. Add voice/caption UX, handwritten/diagram feedback and citation viewer. Verify languages and safety pipeline. Dependencies: 11,15.
- [ ] 19. Add low-bandwidth packs, localized UI and student portfolios. Verify offline/mobile/language flows. Dependencies: 16,18.
- [ ] 20. Add SSO/roster/LMS integration adapters using chosen providers. Verify sandbox contracts. Dependencies: 13, owner provider settings.
- [ ] Checkpoint D: complete all acceptance criteria; document remaining external release approvals.

## Verified learning/browser slice — October 12, 2026

- Backend/root: 126 passed. Frontend: 82 passed across 18 files. Production browser: 9 passed, including ten fresh-profile login attempts and real offline/reconnect/logout checks.
- ESLint, production build/TypeScript, expanded Ruff/format (58 files), tracked whitespace check and 10/10 reference grader cases pass. These are not live-model, WCAG or deployment certifications.
- Schema version 9 adds reviewed practice; exercised against temporary databases only. New practice content is school-approved, not independently verified NCERT material.
- Fixed first-install reload loss, public offline-cache deletion, mobile practice clipping, quiz hard-refresh setup and failed-submission fallback behavior. Reproductions and verification are in the linked record.
- npm still reports five high findings. The requirements-based Python audit is inconclusive due to setup failure; the global installed-environment scan also reports findings and is not project-isolated. Release scan gates are not waived.
- Tasks 5–20 remain partially complete or open as marked above. No paid services, live provider call, production cutover, live retention run or verified learning-gain claim.

Next contained engineering slice: task 10 explainable intervention integration from the accepted diagnostic evidence. Existing review-bank practice and diagnostic results must not be relabelled validated diagnosis or measured learning gain. Supply-chain remediation, broader decomposition and remaining task 7 acceptance remain open; external release choices stay separate.

## Verified foundation checkpoint — October 7, 2026

## Consent/retention slice — October 8, 2026

- Backend/root regression: 101 tests pass, including 15 new policy/retention tests. The initial sandbox run could not create temporary databases; approved outside-sandbox runs passed against isolated test databases.
- Frontend regression: 42 tests pass across eight files. The new approval panel's seven tests passed before privacy-page integration was tested.
- Ruff check and formatter (48 files), ESLint, TypeScript and the Next.js production build pass. Git diff whitespace check passes.
- Schema version 8 adds minimal versioned approval decisions. No live database migration, live-data deletion, hosting provisioning or live model call performed.
- Teacher feedback verifies both caller and student approval under configured policy, rejects adult subjects and omits the dedicated student-name field from model prompts.
- Task 5 remains partially complete: guardian/staff approval UI, published owner policy and retention execution/backup workflows remain. Browser/accessibility journeys and previously tracked dependency advisories are still release blockers; this slice did not rerun dependency scans or claim deployment readiness.

### Skill use for this slice

Planning-and-task-breakdown kept this slice in the existing dependency plan. Security-and-hardening shaped fail-closed production gates, live authority checks and non-destructive retention. Python-testing-patterns drove isolated fixtures and abuse cases. Frontend-ui-engineering shaped semantic controls and loading/error states. Frontend-testing required panel verification before page integration. Verification-before-completion required fresh regression, lint, types and build evidence. These skills were used for implementation, not a legal-compliance certification.

## October 7 evidence

- Backend: 86 tests pass (`python -m pytest -p no:cacheprovider`), including route coverage, two-school authorization, atomic chat ownership, cookie CSRF, live role/deactivation checks, privacy erasure, safety review and mocked model/upload gates.
- Frontend: 35 tests pass across seven files, including credential migration, cookie restoration/revocation/offline logout, scoped quiz cache, IndexedDB erasure, proxy cookie forwarding, math safety and privacy-page interactions.
- Ruff check and formatter pass. TypeScript and Next.js 16.4.0 production build pass. ESLint passes; the error boundary's deliberate hard-navigation recovery is locally documented.
- Reference-answer grader gate: 10/10 cases pass. This verifies deterministic graders, not live model correctness or learning gains.
- npm advisories reduced from 28 (3 critical) to 7 (0 critical): 5 high in the ESLint glob dependency tree and 2 moderate in the typography parser tree. Full scan still blocks CI; no forced downgrade or blanket exemption applied.
- Python resolved-requirements scan reduced from 16 findings in 7 packages to 7 findings in 2 packages: Chroma (no fix listed by the service) and the current pytest <9 constraint. Scan still blocks CI. No claim that the runtime dependency stack is vulnerability-free.
- New routes/pages: `/auth/session`, `/auth/sessions`, `/auth/logout-all`, `/v2/privacy/requests`, fulfilment and safeguarding queues; `/privacy` and `/governance` in role navigation.
- Paid infrastructure: none provisioned. Existing production database, vector store and real credentials were not migrated or overwritten; tests use temporary/in-memory databases.

## October 7 historical next-slice record (superseded by current tracker)

Task 5 requires an explicit consent/guardian and retention policy. The pages describe actual storage and backup limits; they are not legal compliance certification. Task 6 has lint/evaluation/advisory gates installed but remains incomplete until scan failures are resolved or narrowly reviewed. Tasks 7–20 are not implemented by this checkpoint. No live AI evaluation, browser/accessibility/visual audit, Docker restore/load rehearsal, PostgreSQL/Redis rollout, or school-provider integration has been claimed.

Implementation used planning, security hardening, API design, Python/frontend testing, UI engineering, dependency-upgrade and verification skills. These drove the dependency-ordered plan, abuse-case tests, minimal disclosure, explicit pending backup state and staged upgrades.
