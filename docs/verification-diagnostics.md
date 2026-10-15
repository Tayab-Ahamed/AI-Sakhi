# Diagnostic verification — October 15, 2026

Status: implementation verification passed; independent final review pending. This is roadmap task 9's diagnostic slice, not completion of all remaining phases or production-release approval.

The user approved the specification, twelve-task plan and Native sequential execution with independent final review. Branch: `codex/school-curated-diagnostics`, from `main` at `1a55322`. The dirty foundation was preserved. Feature-owned new files are committed incrementally; integration changes in pre-existing dirty/untracked files remain in the working tree and must accompany integration. The commit range alone is not a deployable handoff.

## Latest evidence

| Gate | Observed result |
| --- | --- |
| Full backend pytest | 247 passed, 0 failed/skipped, 33.18s |
| Full frontend Vitest | 138 passed in 24 files, 0 failed/skipped, 6.94s |
| Frontend lint / installed TypeScript | Exit 0 after staff-list synchronization |
| Next production build | Exit 0; 28/28 static-page generation tasks; both new routes present |
| Ruff / format | Exit 0; 72 files already formatted |
| Deterministic reference graders | 10/10 pass; not live-model validation |
| Synthetic Edge browser | 10/10, 0 failed/skipped in 100.28s on the rebuilt staff-list fix and fresh temporary state |
| Independent review | Pending |

Root commands: `python -m pytest -p no:cacheprovider --tb=short --show-capture=no`, `python -m ruff check backend scripts tests evals`, `python -m ruff format --check backend scripts tests evals`, `python evals/run_evals.py`.

From `frontend`: `npm test`, `npm run lint`, `node node_modules/typescript/bin/tsc --noEmit`, and `$env:BACKEND_URL='http://127.0.0.1:8100'; npm run build`. Follow [browser reproduction](browser-testing.md) for fresh temporary state and `node --test tests/e2e/sakhi.spec.cjs`. Observed runtime: Node 24.14.1, preinstalled Playwright 1.62.1, installed Edge 155.0.4283.45. No downloaded browser CLI or real browser profile.

## Specification acceptance mapping

| Requirement | Evidence |
| --- | --- |
| Scoped drafts, graphs/coverage, immutable publication, bounded historical candidates | MCQ/rules/draft/publication tests and actual UI authoring/publication |
| Eligible owner attempts, skips/counts/states/ancestor reasons and historical results | Rules/attempt tests, real learner/result RTL, mixed-answer/resume/recall browser workflow |
| Four concurrent requests, stable retries and atomic evidence without mastery inflation | Four-way service and HTTP create/publish/start/submit tests; post-insert publication and post-update completion failure injection; one-event/zero-progress assertions |
| Roles/schools/users/classes/live accounts, CSRF/privacy/no key leaks or generation | Diagnostic authorization/privacy plus existing auth/governance/practice tests; cookies/CSRF/logout/route audit; publisher-erasure history |
| Empty/error/reload/conflicts/frozen retry/response-loss/identity/focus/controls | Real-child RTL; expiry and late-list regressions; ArrowDown radios, 44px labels, mobile menu clearance, 320/768/1024/1440 bounds, vertical scroll and logout/classmate 404s |
| Existing behavior and complete engineering gates | Full suites above; nine preserved browser cases plus complete diagnostic case; style/types/build/reference graders |

## Reproductions and fixes

- Existing MCQ extraction followed 12 missing-module failures, with unchanged practice behavior. Rules, drafts, publication, attempts and HTTP tests also failed before implementation.
- Full backend initially had 239 passes/four 429 setup errors: temporary school fixtures shared limiter counters. Test-process counters now reset per fixture; production 200/minute limits are unchanged.
- Real Edge rejected the concept-ID HTML pattern. A DOM-derived v-mode regression reproduced it; escaping the literal hyphen fixed it. The HTML attribute is compiled in v-mode. [HTML Living Standard](https://html.spec.whatwg.org/multipage/input.html#the-pattern-attribute).
- An all-strength reason omitted exact counts; a failing test preceded count-bearing server copy.
- Mounted expiry retained a resume UUID; a fake-clock regression preceded cleanup.
- Screenshot inspection found a stale empty staff list after publication. A late-list-response regression failed before list synchronization. Refreshed screenshots show the created assessment and its edit control.
- Browser tests now await the linked-learner dropdown and scope the withdrawal alert away from Next's separate route announcer. These were test timing/selector fixes, not weaker authorization assertions.

## Real-browser coverage and limits

The diagnostic case authors/reviews six synthetic questions, curates a two-concept chain, previews and publishes two versions, resumes after an unsent selection/reload, checks key-free pending payloads, submits wrong/correct/skip selections, focuses exact-count evidence, checks prerequisite reasons, starts another attempt, withdraws the latest version, observes denial/no older-version fallback, retains own completed history and denies both attempts to a classmate after logout/login.

Ignored `.artifacts/browser` holds manually inspected mobile editor/result, desktop withdrawal and dark-theme result screenshots, console logs and metadata-header timings. Normal role journeys reject unhandled JS and unexpected console errors; deliberate 401/403/409 and offline resource errors are recorded. Cold-login/first-install cases prove their explicit input/session outcomes, not a universal console audit.

The final console record contains 28 expected resource-error entries and zero warning entries. Monitored normal journeys had no unexpected console or unhandled JavaScript errors. The browser test uses real UI authoring, cookie/CSRF proxy and server scoring, not mocked diagnostic responses.

No approved screenshot baselines, full screen-reader/WCAG certification, physical-device/cross-browser coverage, live AI accuracy, real curriculum validation, load/restore drills, measured learning gains or deployment are claimed. There is no diagnostic offline queue/private cache.

## Dependency release gates

Fresh lockfile `npm audit --json`: five high findings, zero critical/moderate/low, in the existing ESLint glob chain. No forced downgrade, package change or waiver.

Fresh requirements-based Python audit completed: seven entries across Chroma 1.5.9 (five entries/four distinct IDs) and pytest 8.4.2 (two duplicate entries for one ID), five distinct IDs total. The report lists no Chroma fix and suggests pytest 9.0.3 outside `<9`. These remain release gates, not a clean audit or a blind-upgrade instruction.

No live database/vector store/credential, published owner policy, paid service, production migration or deployment changed. Broader phases remain open in [the tracker](../tasks/todo.md).

## Skills and execution decisions

Executing-plans and TDD required sequential task briefs, observed red/green gates and a durable ledger. API/security skills shaped strict projections, live authority and atomic intents. Frontend-testing required real children verified before integration; UI/accessibility/responsive skills shaped semantic controls, focus and bounded layouts. Browser-testing/systematic-debugging exposed the native pattern and screenshot/list defects. AI-debt-detector checked failure paths, cleanup, dependencies and drift. Independent review follows the requesting-code-review gate.

Execution rulings are retained in the plan-scoped ledger: work in the existing checkout on a feature branch; leave inseparable baseline integration changes uncommitted; add a narrow diagnostic body-authority 422 guard; extract two UI state hooks; use a subscribed session-expiry gate; reset limiter counters only in temporary test fixtures. No final-review verdict is implied by these choices.
