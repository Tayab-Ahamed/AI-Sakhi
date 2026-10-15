# Reproduce the synthetic browser checks

These checks run only against `http://127.0.0.1:3101`. Do not point them at a live school. The backend launcher creates a fresh temporary SQLite/Chroma directory, synthetic role accounts and a random session secret, disables demo seeding, supplies no real Groq key and enables offline model-hub settings. This is not a network-egress guarantee or a production configuration.

The current suite uses Node's test runner with the already installed Playwright runtime and an installed Edge executable. It does not download or execute a browser CLI. The recorded environment was Playwright 1.62.1 and Edge 155.0.4283.45 on Windows.

## Local run

Start the fixture in one terminal from the repository root:

```powershell
python scripts/browser_test_server.py
```

Build and start a separate standalone frontend from `frontend`:

```powershell
$env:BACKEND_URL='http://127.0.0.1:8100'
npm run build
New-Item -ItemType Directory -Force .next/standalone/public, .next/standalone/.next/static | Out-Null
Copy-Item -Path public/* -Destination .next/standalone/public -Recurse -Force
Copy-Item -Path .next/static/* -Destination .next/standalone/.next/static -Recurse -Force
$env:HOSTNAME='127.0.0.1'
$env:PORT='3101'
$env:BACKEND_URL='http://127.0.0.1:8100'
node .next/standalone/server.js
```

In another terminal from the repository root, select the existing runtime/browser:

```powershell
$env:NODE_PATH='C:\Users\tayab\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:SAKHI_BROWSER_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$env:SAKHI_BROWSER_TEST='synthetic-only'
node --test tests/e2e/sakhi.spec.cjs
```

`NODE_PATH` is machine-specific; use the location of an already installed compatible Playwright runtime on another machine. Set `BACKEND_URL` in the server's terminal as well as during the build: the same-origin proxy reads it at runtime. Stop the standalone frontend before rebuilding. Restart the fixture before each complete suite: guardian empty-state checks and question-authoring checks intentionally depend on a new synthetic database. Fresh browser profiles alone do not reset server data.

## Evidence and limitations

Eleven cases are documented in [the feature test record](../tests/e2e/sakhi.md). The diagnostic case includes real six-question authoring/review, two-concept curation, two publication versions, online resume, mixed evidence, withdrawal and shared-device isolation. A staff-recovery case replaces an unavailable selection while preserving prerequisite links, publishes a new version, then signs out in a second tab and verifies that a definitive server denial removes private content and offers reauthentication. Generated screenshots, console messages and RAG request-to-response-header timings are written under `.artifacts/browser`, which is ignored by Git. No browser cookies, local-storage tokens or real credentials are extracted. The first-install case delays registration until input has been entered, then runs the real worker activation path.

Anonymous restoration 401s, deliberately denied 403s, diagnostic withdrawal 409s (allowlisted only in that deliberate-denial journey) and expected offline network failures are retained as evidence. Normal role journeys fail on unhandled JavaScript errors and other console errors. The offline case asserts its fallback, unavailable authenticated API, reconnect and logout outcomes; it does not classify every offline console resource failure as a product defect.

Screenshots are inspected manually, not compared against approved visual baselines. Viewport checks are not physical-device testing. Keyboard/menu/radio semantics are not a full screen-reader/WCAG audit. Navigation smoke coverage does not validate every feature's generated content or persistence. Live AI accuracy, cross-browser coverage, reliable offline learning packs, load/restore drills and deployment remain separate work.
