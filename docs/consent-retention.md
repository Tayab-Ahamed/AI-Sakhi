# AI approval and retention controls

This is an engineering control, not verification of legally valid consent. The owner must choose approval authority, publish a full policy, verify school/guardian relationships and review provider agreements before rollout. No new hosting or paid service is required.

## Configuration

`SAKHI_AI_APPROVAL_MODE` is `unconfigured` (default), `guardian` (currently linked parent in the same school), or `school` (active teacher/administrator in the same school). Student accounts cannot approve themselves. Non-student accounts acknowledge for themselves. `SAKHI_PRIVACY_POLICY_VERSION` is an operator-controlled version identifier, at most 100 characters. Changing it requires new approval. It must change when material sharing terms change.

Configured policy gates all existing model-generating API routes, including uploads, quiz evaluation and teacher feedback. Unconfigured production blocks AI requests; unconfigured development permits them and explicitly reports that approval is not enforced. This development exception is not a production authorization. Existing processing restrictions always block AI requests independently of approvals.

Approval records are append-only decisions carrying subject, school, actor, mode, policy version and timestamp, not a collected signature, proof of age or verified guardian identity. Authorization uses current account role, activity and relationship. Withdrawal blocks subsequent AI requests, not a model call already in flight. A later authorized approval can restore permission unless the account is separately restricted. Export includes subject approval records; deletion erases those records and anonymizes the deleted actor on other subjects' records.

## API workflow

- `GET /v2/privacy/policy`: authenticated policy/settings and sharing limitations.
- `GET /v2/privacy/approvals/{user_id}`: subject or authorized linked guardian/school staff can read current state.
- `POST /v2/privacy/approvals/{user_id}`: body `{"granted": true, "policy_version": "your-current-version"}`. The selected authority approves students; subjects can withdraw themselves. Cross-school administrators have no exception. A stale/unconfigured policy returns 409.
- `GET /v2/privacy/retention/preview`: school administrator only; returns counts, not identifiers or transcripts.

Browser callers use the existing same-origin cookie/CSRF proxy. Explicit API clients can use bearer authentication. The privacy page displays own-account status, allows adult-role acknowledgement and allows withdrawal. The parent dashboard selects only currently linked learners; school governance selects an authorized school roster. Guardian mode permits the linked parent to acknowledge/approve, while school mode permits school staff. Other authorities see read-only status. Subject or policy changes reset acknowledgements. These interfaces are browser-tested with synthetic accounts; the operator still must verify real relationships and publish the policy before rollout.

Teacher feedback requires a student account identifier under enforced policy. Both teacher and student approval are checked. The dedicated student-name field is no longer sent to the model; free-form topics and prompts must still avoid sensitive information.

## Retention preview, not deletion

`SAKHI_CHAT_RETENTION_DAYS=0` disables planning. A positive value enables a read-only preview based on session `updated_at`, normalized to UTC, strictly older than the cutoff. Only sessions whose stored school matches the current user's school are counted. Unknown timestamps are excluded. Any linked safeguarding event holds its session from expiry candidacy, even after acknowledgement, until a separate safeguarding policy is chosen.

The preview never deletes or schedules work. It does not cover backups, browser/downloaded copies, provider stores, learning records, safety-event records or orphan normalized messages. No retention sweep or backup completion claim is available. Follow-up work must add scoped transactional execution, dependent-message/bookmark cleanup, safe preview confirmation, hold handling and operator backup-expiry evidence before automatic expiry is enabled.

Do not use this document as the published legal policy. No production database or external provider data was modified to implement these controls; schema version 8 is applied by the normal migration lifecycle after operator review.
