# School-curated diagnostics

This feature provides tentative evidence from school-reviewed MCQs, not a validated diagnosis, certified curriculum, confidence estimate or proof of mastery. Repeating questions is not independent evidence of improvement. Schools supply content; no assessment/prerequisite graph is seeded automatically.

## Authoring

Active teachers/admins use **Diagnostic editor** (`/teacher/diagnostics`). Create a title/class/subject draft. Subject must exactly match the question bank: “Math” and “Mathematics” are different.

Add one to six concepts. Local IDs start with a lowercase letter and contain at most 40 lowercase letters, digits or hyphens; labels support Unicode. Select school-defined prerequisite suggestions, not inferred or validated learning dependencies. Cycles, missing concepts, duplicate edges and self-reference are rejected. Remove references before renaming/removing a referenced concept.

Publish only when each concept has exactly three distinct approved MCQs. No question may be shared between concepts. Paginated candidates match the saved school/class/subject; malformed historical pages still advance. Save changed class/subject metadata, then refresh candidates. **Staff preview** shows saved selections independently of the current page and warns about unavailable questions without replacing them. It creates no learner evidence.

Reopen a draft to refresh eligibility after a question is recalled or its scope changes. **Remove selected question** frees an unavailable selection without deleting the concept or its prerequisite links; choose a replacement before publishing. A definitive server 401/403 clears private staff content and pending intents, ignores late responses and offers **Sign in again**. Ordinary network, validation and revision errors preserve local edits.

Saving uses an expected revision. A stale response preserves local edits and offers explicit reload, never silent overwrite. Publishing saves first, then creates an immutable private snapshot/version. Uncertain publication retries the same saved revision. Teachers may publish their own content; independent second-reviewer approval is not claimed.

Withdrawal is terminal: it blocks new starts and unfinished attempts, while preserving completed history. New starts never fall back to an older version. A newly reviewed draft revision can publish a new version. Superseded nonwithdrawn attempts may finish if their content remains eligible.

## Learners and evidence

Students use **Diagnostics** (`/diagnostics`). The server derives current school/class from the authenticated active account. Staff/parents cannot impersonate learners. Choose an option or **I'm not sure** for every question. Null means explicit skip, not an incorrect answer. Server-owned keys grade the immutable snapshot; pending payloads contain no correct indices/explanations. Only the completed owner gets reviewed answers and feedback.

| Three-question concept evidence | Tentative state |
| --- | --- |
| Fewer than three answered | Insufficient evidence |
| Three answered, zero or one correct | Review suggested |
| Three answered, two or three correct | Provisional strength |

Results show correct/answered/skipped/assigned counts, separate ancestor prerequisites suggesting review and needing more evidence, and explain the first non-strength concept in stable prerequisite order. All-strength suggests spaced practice, never “all mastered”. These thresholds are product heuristics. Suggestions do not restrict access to harder content.

Completion atomically creates one minimal `diagnostic_completed` event. Diagnostics do not write legacy progress/mastery or call an AI provider. Broader mastery/recommendation/sprint/recall integration remains a separate roadmap phase.

## Resume, retry and offline limits

Only an attempt UUID is stored at `sakhi_diagnostic_attempt:<school>:<user>:<encoded class>`. This feature persists no questions, keys, results, credentials or unsent choices. An online authorized GET must succeed before showing resumed content. Unsent choices are lost on reload, as the UI explains.

Uncertain submission freezes its exact answer map for identical retry. Reload after committed completion restores the stored result without another event. A different-answer conflict shows authoritative stored evidence with an explicit notice. Withdrawn/recalled references are cleared with a return-to-list action. Logout, denied authorization, session expiry and account/class/school changes clear the reference.

There is no private service-worker cache or offline submission queue: reconnect to continue. Blocked browser storage may prevent a reference surviving reload; it never grants access. **Start a new attempt** deliberately clears the old reference. A full attempt-history browser is not part of this phase.

## Security, storage and privacy

Ten `/v2/diagnostics` routes use explicit authentication, live scope checks, same-origin cookies/CSRF and existing limits. Modeled write bodies forbid extra fields and caller authority. Withdrawal is bodyless and currently ignores arbitrary non-authority body fields; strict empty-body alignment is a deferred contract cleanup, not a scoring/authority bypass. IDs/indices are strict integers; bool/string/float, missing/extra IDs and out-of-range selections are rejected. SQL length/page bounds precede historical JSON parsing. Errors contain no answer keys.

Own export includes attempts and completed feedback; pending exports remain key-free. Staff author exports contain their own drafts/publications, not learners' attempts through joins. Active-database erasure removes owned attempts/events and unpublished drafts without publications. Retained school publications are withdrawn/anonymized, and unpublished draft text/original creation fingerprint cleared; other learners' completed evidence stays stable.

School-owned published free text may remain in anonymous history; this is not automatic free-text redaction. Safeguarding, backups/external copies and published retention policy remain separate obligations. No legal-compliance or complete backup-erasure certification is made.

Migration 10 adds constrained blueprints/versions/attempts; verification uses temporary databases. No live school DB/vector store, real content publication, paid service or deployment was changed. See [verification](verification-diagnostics.md) and [browser reproduction](browser-testing.md).
