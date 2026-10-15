# Verification — October 12, 2026

Status: verified local implementation slice; **not all roadmap phases complete or production-ready**. Existing unrelated working-tree changes were retained. No cloud provisioning, live school migration, live-data retention run or real model evaluation was performed.

## Delivered in this continuation

- Linked-parent/school-staff approval roster UI, current-policy acknowledgements and read-only authority restrictions; no invented guardian links or published legal policy.
- Server-owned, school-reviewed MCQ practice with answer-key withholding, atomic progress, identical-retry recovery, recall checks and privacy lifecycle. See [the contract and limits](reviewed-practice.md).
- Login readiness/role tests, quiz hard-refresh initialization and an explicit failed-submission state instead of fallback grading/writes.
- RAG metadata reads no longer initialize embeddings or create an empty index. Retrieval still initializes the configured embedding model when actually needed.
- Service-worker updates refresh only after explicit user acceptance, with event cleanup. First installation no longer reloads edited login fields.
- Session/logout cleanup preserves only the exact current public-assets cache while deleting private/legacy caches; real offline fallback, reconnection and logout are exercised.
- Mobile practice heading clearance and vertical scrolling, teacher-editor labels, and operational-script formatting cleanup. Formatting did not execute a backup or preflight operation.

## Fresh results

| Check | Result |
| --- | --- |
| `python -m pytest -p no:cacheprovider --tb=short --show-capture=no` | 126 passed; isolated test databases. |
| `npm test` in `frontend` | 82 passed across 18 files. |
| `node --test tests/e2e/sakhi.spec.cjs` with the synthetic fixture | 9 passed, 0 skipped; 61.77 seconds. Includes ten fresh-profile login attempts. |
| `npm run lint`; production `npm run build` | Passed, including TypeScript and 26/26 page-generation tasks. Public offline HTML was copied into standalone assets and exercised in-browser. |
| `python -m ruff check backend scripts tests evals`; matching `format --check` | Passed; 58 files formatted. |
| `python evals/run_evals.py` | 10/10 reference-answer grader cases passed, not live AI quality. |
| `git diff --check` | Passed for tracked changes; final added source files were also linted/tested. |

The browser covers actual synthetic login through the cookie proxy, four roles, linked guardian approval/reload, learner withdrawal and server AI denial, eleven learner destinations, staff-route redirects, logout, governance queues, reviewed practice, mastery visibility, 320/768/1024/1440px practice bounds and a different learner on the same device. Screenshots include mobile approval, learner denial, governance, reviewed practice and public offline fallback. The final normal-journey console record contains expected 401/403 responses, with no unhandled JavaScript errors or unexpected console errors. Offline resource failures are expected and retained.

## Reproductions and corrections

1. Delaying first service-worker registration until the login name was entered reproduced an unexpected page reload (navigation count changed from 2 to 4). The same test passes after replacing unconditional `controllerchange` reloads with explicitly accepted updates. Four lifecycle tests cover first control, accepted updates, waiting updates and disposal.
2. The narrow practice screenshot showed the fixed menu covering the heading. A browser regression failed before reserving mobile space and enabling the practice main area's vertical scroll; it passes afterward.
3. An actual offline reload returned a plain 503 “Offline” response because session cleanup erased the precached public screen. The cache-boundary unit test failed before the fix. The browser now verifies unavailable authenticated API data, generic fallback, automatic reconnect and offline navigation after logout, followed by anonymous redirect.
4. A pending attempt could previously be read after school recall even though submission was denied. The recall read/retry test failed, then passed with the shared pending-question guard. Completed historical results remain readable and retryable.
5. One browser test incorrectly expected a withdrawal control in a fresh, unapproved fixture. Its precondition now waits for approval status and withdraws only if approved. The complete final suite ran against a newly started fixture, not reused practice data.

## Performance observations, not a controlled benchmark

Earlier browser runs observed roughly 90–110 seconds during metadata calls while embedding initialization/model-network behavior was involved. Removing that initialization is guarded by five focused tests. A subsequent cold Chroma client initialization still took approximately 5.4–6.3 seconds. The final run recorded 46 metadata requests at 17–100ms (44ms mean), but preceding login probes had already warmed the backend. Offline model settings and warmed state differ from the earlier observation: these figures are **not** an apples-to-apples speedup, Core Web Vitals score or load-test result. Cold import/client startup remains a follow-up profiling target.

## Dependency scans remain release blockers

- The October 12 npm audit reports five high findings in the braces/micromatch/glob ESLint dependency chain, zero critical and zero moderate. The proposed automatic fix downgrades the Next ESLint configuration to 0.2.4; that incompatible blanket downgrade was not applied. CI's scan is not waived.
- The resolved `pip-audit -r requirements.txt` scan failed while preparing/upgrading its temporary environment. This is **inconclusive**, not a clean result.
- A fallback installed-environment scan covered 401 packages and reported 395 advisory entries across 50 packages. That shared Python environment includes unrelated packages; these counts are not an isolated project vulnerability total or a count of unique CVEs. Findings also appeared for direct project dependencies including Chroma, pytest, requests and sentence-transformers. No bulk upgrade, global-package mutation or advisory exemption was applied.

Reproducible project-only Python resolution and individually verified dependency fixes remain required before release. Passing functional tests does not override supply-chain findings.

## Remaining work

The [tracker](../tasks/todo.md) remains authoritative. Owner-published approval/retention policy and backup evidence, broader accessibility/browser coverage, domain decomposition, diagnostic/prerequisite learning loops, rubrics/digest preferences, PostgreSQL/Redis/private upload and offline-write infrastructure, restore/load/image scans, voice/multimodal/localization/portfolios and selected SSO/LMS integrations are not completed by this slice.

## Skills that influenced the implementation

Planning-and-task-breakdown kept partial phases explicit. API-and-interface-design and security-and-hardening shaped trusted identity, hidden keys and fail-closed boundaries. Python/frontend testing and TDD required isolated negative/concurrency tests and red/green bug reproductions. Systematic-debugging traced reload and offline failures to the worker/cache lifecycle instead of adding timing delays. E2e-tester guided semantic selectors and condition waits using the preinstalled browser runtime; no Playwright MCP was available. Frontend-ui-engineering/responsive-design shaped labelled controls, scroll and mobile clearance. Performance-optimization required measured observations with warm/cold caveats. Code-review-and-quality drove boundary review and broader formatting checks. These are implementation practices, not security, legal or accessibility certification.
