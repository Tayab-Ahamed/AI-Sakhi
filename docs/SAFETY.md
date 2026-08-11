# Safety model

AI Sakhi talks to children. Safety is a product requirement, not a filter bolted on
at the end. The implementation lives in `backend/safety.py` and is enforced in
`backend/chat.py` before and after every model call.

## Pipeline

1. **Normalize** the message (case, spacing, common obfuscation).
2. **Classify** it into a severity: `none`, `low`, `medium`, `high`, `crisis`.
3. **Route**:
   - `crisis` -> the model is never called; a helpline response is returned immediately.
   - `high` -> refusal with a redirect to a trusted adult.
   - `medium` / `low` -> answered with an added caution instruction.
4. **Log** an entry to the `safety_events` table (category, severity, minimal context).
   Message bodies are not stored for crisis events.
5. **Re-scan the model output** so an unsafe completion cannot reach the student.

## Categories

self_harm, violence, sexual_content, abuse_disclosure, substance_use, hate,
personal_information, exam_cheating, prompt_injection.

## Helplines shown to users (India)

| Service | Number |
| --- | --- |
| Tele-MANAS (mental health, 24x7) | 14416 or 1-800-891-4416 |
| KIRAN mental health helpline | 1800-599-0019 |
| CHILDLINE India | 1098 |
| Emergency services | 112 |

These exact numbers also appear in `HELPLINES` in `backend/safety.py`. If you change
one, change both in the same commit.

## Prompt injection

Retrieved textbook passages are untrusted input. They are wrapped in an explicit
untrusted-content fence and the system prompt instructs the model to treat them as
data. `detect_injection()` flags override attempts and records a
`sakhi_prompt_injection_total` metric.

## Escalation

Safety events are visible to teachers and admins. Acknowledging an event records who
reviewed it and when. The system does not notify parents automatically; a human
decides.

## Limits

The classifier is heuristic, tuned for Indian-English and Hinglish, and will produce
both false positives and false negatives. It is a triage aid, not a clinician.
