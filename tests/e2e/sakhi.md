### E2E Tests: synthetic learning, governance and offline journeys

Preconditions: loopback-only synthetic backend, production frontend build on port 3101, fresh browser profiles; no live school database or real model key.

- Guardian: only linked learner, acknowledgement required, approval survives reload, panel fits 320px, hidden mobile navigation and Escape closure.
- Learner: observes guardian decision, cannot self-approve, withdraws and receives a visible 403 denial when requesting new AI questions.
- Navigation: learner progress/study/export destinations render; staff-only routes redirect; logout cannot restore the prior session.
- Teacher: guardian policy is read-only; safeguarding queue is available but administrator privacy queue is absent.
- Administrator: school governance queues render; guardian policy does not silently grant staff authority.
- First install: hold real worker registration until login input is entered; controller acquisition must not reload or clear the form.
- Cold login: enter and submit credentials in ten fresh browser profiles; authenticated server role determines the destination.
- Practice mobile layout: heading clears the fixed menu, the main area scrolls at 320×320, and results fit 320/768/1024/1440px widths.
- Reviewed practice: teacher authors/approves a school question; student receives no key, answers, sees server feedback and mastery evidence; another learner on the same device sees no prior result.
- Offline: a previously visited private page becomes the generic public screen; authenticated API fetch is unavailable; reconnect restores the authorized page. After logout, offline fallback remains available and reconnection redirects anonymously.
- Diagnostics: teacher authors/reviews six questions and curates a two-concept chain, previews and publishes two immutable versions. Learner resumes online without unsent choices, receives no pending key, uses native radio keyboard controls and explicit skips, then sees focused exact-count evidence and prerequisite reasons. Labels are 44px on mobile; results fit 320/768/1024/1440px with menu clearance/vertical scrolling. A real dark-theme toggle is exercised. Staff withdrawal blocks a separate pending attempt without older-version fallback; completed history remains own-only. Logout/login as classmate reveals no prior content and both old attempt GETs return 404.

- Staff recovery: author/review a replacement question, reopen a draft with subject-mismatched selections, remove one unavailable ID while retaining prerequisite edges, restore the intended bank and publish version three with the replacement. Sign out through the account UI in a second tab; the populated editor's next server denial must remove private fields/previews/actions and provide a working sign-in link.

The eleven saved cases include the combined parent/learner journey. Screenshots capture synthetic mobile approval, learner/staff denial, governance, reviewed practice, diagnostics, selection recovery and offline state. Normal role journeys reject unhandled JavaScript and unexpected console errors; deliberately denied/anonymous responses and offline resource failures are recorded. Cases use condition waits, not fixed sleeps. These checks do not establish live AI accuracy, full WCAG compliance, physical-device behavior, learning gain or deployment readiness.
