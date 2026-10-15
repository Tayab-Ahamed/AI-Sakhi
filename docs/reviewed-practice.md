# School-reviewed practice

This provider-independent learning slice connects the existing teacher question bank to `/practice`. It is part of roadmap tasks 8, 11 and 16, not completion of the diagnostic, prerequisite, hint-ladder or distributed-offline phases. No AI provider is called by these practice endpoints.

## Authority and content

Only an active student in a school can use the endpoints. Identity, organization and current class come from the authenticated server account, not request fields. Attempts remain private to that learner and are inaccessible after a school/class change. Teachers and administrators cannot impersonate a learner through these routes.

Only school-approved MCQs for the learner's current class are served. Drafts, rejected questions, other schools/classes and malformed historical answer keys are excluded. Questions have 2–10 nonblank, distinct options; the authoring key is a letter or an exact option value, with letters taking precedence. This is school review, not independent NCERT verification. Questions remain in the teacher's original language.

The current catalog scans at most 1,000 matching questions and reports `truncated` when that limit is reached. It is not a paginated, large-school question catalog. Practice requests ask for 1–10 questions and may return fewer when the approved bank is smaller.

## HTTP contract

Browser clients use the existing same-origin cookie/CSRF proxy. Explicit API clients may use bearer authentication.

| Method and route | Behavior |
| --- | --- |
| `GET /v2/practice/topics` | Approved subject/chapter counts for the current school/class; no keys. |
| `POST /v2/practice/attempts` | UUID `creation_key`, `subject`, optional `chapter` and `count`; returns a server-owned attempt (201). |
| `GET /v2/practice/attempts/{uuid}` | Own attempt only; unfinished recalled content returns 409. |
| `POST /v2/practice/attempts/{uuid}/submission` | `answers` maps every question ID to a strict integer option index; returns the completed attempt. |

Extra request fields, booleans/string answer indices and out-of-range or missing answers are rejected. Clients cannot supply a score or answer key. Active responses allowlist question ID, text and options; explanations and correct indices appear only after completion.

## Retry and recall semantics

Creation keys identify an intent within an account. Reusing the same key and parameters recovers the same attempt; changed parameters conflict (409). The browser retains this key during an in-page network retry, but does not persist or resume unfinished attempts after a reload.

The server snapshots approved content. Before serving or grading an unfinished attempt, it checks that those questions are still approved in the same school/class. Recall returns 409 and asks the learner to start again. Completed results remain historical evidence even if a question is later recalled.

Submission is one SQLite transaction: server scoring, progress/streak update, attempt completion and learning event. Identical retries return the stored result without another progress row; different answers after completion conflict. Tests exercise four concurrent creation/submission requests and rollback after an interrupted scoring transaction. This is not PostgreSQL/Redis or a general offline-write queue.

## Learning and privacy

Results show the teacher's explanation and feed the existing topic-mastery calculation. One practice is explicitly not proof of mastery; one recorded result produces low-confidence evidence. Diagnostic validity, prerequisite inference and measured learning gain remain unimplemented acceptance criteria.

Own-account export includes practice, but strips pending answer keys from question snapshots. Active-database account erasure includes owned attempts. Operator retention, backups and externally downloaded copies remain separate obligations; no new automatic deletion is enabled.

## Verification

Twenty isolated practice API tests cover school/role/class boundaries, hidden keys, malformed answers, creation conflicts, recalled reads/retries/submissions, historical results, concurrency, rollback and privacy lifecycle. Seven component tests cover loading/empty/error states, answers, stable retries and reset behavior. The production browser suite exercises teacher authoring/review, learner grading/explanations, mastery visibility, mobile layouts and a different learner on the same device. See [the verification record](verification-2026-10-12.md).
