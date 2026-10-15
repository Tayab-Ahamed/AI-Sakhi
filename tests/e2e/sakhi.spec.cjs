// Run against scripts/browser_test_server.py only, never a live school backend.
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { expect } = require('playwright/test');
const { BasePage } = require('./base-page.cjs');

const origin = process.env.SAKHI_BROWSER_ORIGIN || 'http://127.0.0.1:3101';
assert.match(origin, /^http:\/\/127\.0\.0\.1:3101$/, 'Only the isolated loopback test origin is allowed');
const artifacts = path.resolve(__dirname, '../../.artifacts/browser');
let browser;
const consoleLog = [];
const metadataTimings = [];
before(async () => {
  assert.equal(process.env.SAKHI_BROWSER_TEST, 'synthetic-only', 'Explicit fixture opt-in is required');
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.SAKHI_BROWSER_EXECUTABLE ? { executablePath: process.env.SAKHI_BROWSER_EXECUTABLE } : {}) });
  const probe = await browser.newContext();
  try {
    await expect.poll(async () => {
      try { return (await probe.request.get(`${origin}/login`)).status(); }
      catch { return 0; }
    }, { timeout: 30000, message: 'Standalone frontend must be ready before journeys' }).toBe(200);
  } finally { await probe.close(); }
});
after(async () => {
  await writeFile(path.join(artifacts, 'console.json'), JSON.stringify(consoleLog, null, 2));
  await writeFile(path.join(artifacts, 'metadata-timings.json'), JSON.stringify(metadataTimings, null, 2));
  await browser?.close();
});

async function journey(role, action, expectedStatuses = [401, 403]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return;
    const text = message.text();
    consoleLog.push({ role, type: message.type(), url: page.url(), text });
    // Anonymous session restore and deliberately denied approval requests are
    // expected. Other HTTP/React/JavaScript console errors must fail the case.
    const status = /status of (\d+)\b/.exec(text);
    if (message.type() === 'error' && !(/^Failed to load resource:/.test(text) && status && expectedStatuses.includes(Number(status[1])))) errors.push(`Console: ${text}`);
  });
  const starts = new Map();
  page.on('request', (request) => { if (/\/rag\/(stats|catalog)$/.test(request.url())) starts.set(request, performance.now()); });
  page.on('response', (response) => {
    const start = starts.get(response.request());
    if (start !== undefined) metadataTimings.push({ role, path: new URL(response.url()).pathname, status: response.status(), headers_ms: Math.round(performance.now() - start) });
  });
  const app = new BasePage(page, origin);
  try { await app.login(role); await action(app, page); assert.deepEqual(errors, [], 'No unhandled browser errors'); }
  catch (error) { await page.screenshot({ path: path.join(artifacts, `${role.toLowerCase()}-failure.png`), fullPage: true }); throw error; }
  finally { await context.close(); }
}

test('first worker activation does not reload an edited login form', { timeout: 45000 }, async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  try {
    // Hold registration until the real form contains input, making the race
    // deterministic without modifying activation logic or reading private storage.
    await context.addInitScript(() => {
      const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      const gate = new Promise((resolve) => { window.releaseSakhiWorker = resolve; });
      navigator.serviceWorker.register = async (...args) => { await gate; return register(...args); };
    });
    const page = await context.newPage();
    let navigations = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++; });
    await new BasePage(page, origin).goto('/login?role=parent');
    const name = page.getByRole('textbox', { name: 'Your name', exact: true });
    await name.fill('Browser Parent');
    const beforeActivation = navigations;
    await page.evaluate(() => window.releaseSakhiWorker());
    await expect.poll(async () => {
      try { return await page.evaluate(() => Boolean(navigator.serviceWorker.controller)); }
      catch { return false; }
    }).toBe(true);
    await expect(name).toBeEnabled();
    assert.equal(navigations, beforeActivation, 'First worker activation reloaded the page');
    await expect(name).toHaveValue('Browser Parent');
  } finally { await context.close(); }
});

test('cold login inputs survive consecutive fill events in ten fresh profiles', { timeout: 120000 }, async () => {
  for (let run = 0; run < 10; run++) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await new BasePage(page, origin).goto('/login?role=parent');
      const name = page.getByRole('textbox', { name: 'Your name', exact: true });
      await name.fill('Browser Parent');
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Browser-test-only-42!');
      // Never log entered names, passwords, cookies or tokens.
      assert.equal((await name.inputValue()).length, 14, `Name was lost in run ${run}`);
      await page.getByRole('button', { name: 'Sign in as Parent', exact: true }).click();
      await page.waitForURL(`${origin}/parent`);
    } finally { await context.close(); }
  }
});

test('linked guardian approval persists, learner withdrawal blocks AI, and mobile controls work', { timeout: 150000 }, async () => {
  await journey('Parent', async (app, page) => {
    await app.heading(/parent dashboard/i);
    const panel = page.getByRole('region', { name: 'AI processing approval — Browser Student', exact: true });
    const withdraw = panel.getByRole('button', { name: 'Withdraw AI approval', exact: true });
    await panel.getByRole('status').filter({ hasText: /current (policy approved|approval is required)/i }).waitFor();
    if (await withdraw.isVisible()) await withdraw.click();
    await panel.getByText('Current approval is required.', { exact: true }).waitFor();
    await expect(page.getByRole('combobox', { name: 'Learner', exact: true }).locator('option')).toHaveText(['Browser Student']);
    const approve = panel.getByRole('button', { name: /approve learner/i });
    assert.equal(await approve.isEnabled(), false);
    await panel.getByRole('checkbox').check(); await approve.click();
    await panel.getByText('Current policy approved.', { exact: true }).waitFor();
    await page.reload(); await panel.getByText('Current policy approved.', { exact: true }).waitFor();
    await page.getByText(/no assessment data yet/i).waitFor();
    await page.setViewportSize({ width: 320, height: 800 });
    const bounds = await panel.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 321, 'Approval must fit 320px viewport');
    await expect(page.getByRole('link', { name: 'Privacy & Sessions', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    const toggle = page.getByRole('button', { name: 'Close navigation', exact: true }).first();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await toggle.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Open navigation', exact: true }).getAttribute('aria-expanded'), 'false');
    await page.screenshot({ path: path.join(artifacts, 'parent-mobile.png'), fullPage: true });
  });
  await journey('Student', async (app, page) => {
    await app.goto('/privacy'); await app.heading(/privacy & account sessions/i);
    await page.getByText('Current policy approved.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox').count(), 0, 'No student self-approval');
    await page.getByRole('button', { name: 'Withdraw AI approval', exact: true }).click();
    await page.getByText('Current approval is required.', { exact: true }).waitFor();
    await app.goto('/quiz'); await app.heading(/quiz mode/i);
    await expect(page.getByRole('button', { name: /mathematics/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Linear Equations', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Or type a custom topic...', exact: true }).fill('Fractions');
    const denied = page.waitForResponse((response) => response.url().endsWith('/quiz/generate') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generate 5 Questions', exact: true }).click();
    assert.equal((await denied).status(), 403);
    await page.getByRole('alert').filter({ hasText: /approval/i }).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'learner-approval-denial.png'), fullPage: true });
  });
});

test('learner destinations render and staff pages redirect', { timeout: 180000 }, async () => {
  await journey('Student', async (app, page) => {
    const destinations = [
      ['My Dashboard', /^dashboard$/i], ['Learning Goals', /learning goals/i],
      ['School Practice', /^school practice$/i],
      ['Topic Mastery', /subject & topic mastery/i], ['Leaderboard', /leaderboard/i],
      ['Study Plan', /^study plan$/i], ['Study Notes', /ai study notes/i],
      ['Practice Papers', /practice paper generator/i], ['Flashcards', /flashcards/i],
      ['Focus Timer', /focus timer/i], ['Export Report', /export/i],
    ];
    for (const [name, heading] of destinations) await app.follow(name, heading);
    for (const [route, destination] of [['/admin', '/dashboard'], ['/teacher', '/dashboard'], ['/parent', '/dashboard'], ['/governance', '/chat']]) {
      await app.goto(route); await page.waitForURL(`${origin}${destination}`);
    }
    await app.goto('/privacy'); await app.heading(/privacy & account sessions/i);
    await page.getByRole('button', { name: 'Sign out here', exact: true }).click();
    await page.waitForURL(`${origin}/`);
    await app.goto('/privacy'); await page.waitForURL(`${origin}/onboard`);
  });
});

test('school staff cannot approve under guardian authority', { timeout: 90000 }, async () => {
  await journey('Teacher', async (app, page) => {
    await app.goto('/governance'); await app.heading(/school governance review/i);
    await page.getByText(/selected policy does not authorize/i).waitFor();
    assert.equal(await page.getByRole('checkbox').count(), 0);
    await page.getByText(/no safety events for your school/i).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Privacy requests', exact: true }).count(), 0);
  });
});

test('administrator sees school governance queues and guardian-authority restrictions', { timeout: 90000 }, async () => {
  await journey('Admin', async (app, page) => {
    await app.heading(/admin/i);
    await app.goto('/governance'); await app.heading(/school governance review/i);
    await page.getByRole('heading', { name: 'Privacy requests', exact: true }).waitFor();
    await page.getByText(/no privacy requests for your school/i).waitFor();
    await page.getByText(/selected policy does not authorize/i).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'admin-governance.png'), fullPage: true });
  });
});

test('school practice clears mobile navigation and allows vertical scrolling', { timeout: 45000 }, async () => {
  await journey('Student', async (app, page) => {
    await page.setViewportSize({ width: 320, height: 320 });
    await app.goto('/practice'); await app.heading(/^school practice$/i);
    const heading = await page.getByRole('heading', { name: 'School practice', exact: true }).boundingBox();
    const menu = await page.getByRole('button', { name: 'Open navigation', exact: true }).boundingBox();
    assert.ok(heading && menu && heading.y >= menu.y + menu.height, 'Heading must clear mobile navigation');
    const main = page.getByRole('main');
    assert.equal(await main.evaluate((element) => getComputedStyle(element).overflowY), 'auto');
    assert.equal(await main.evaluate((element) => { element.scrollTop = element.scrollHeight; return element.scrollTop > 0; }), true);
  });
});

test('private page navigation uses a public offline fallback and reconnects', { timeout: 45000 }, async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleLog.push({ role: 'Offline', type: message.type(), url: page.url(), text: message.text() });
  });
  const app = new BasePage(page, origin);
  try {
    await app.login('Student');
    await app.goto('/privacy'); await app.heading(/privacy & account sessions/i);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await context.setOffline(true);
    assert.equal(await page.evaluate(async () => {
      try { return (await fetch('/api/backend/auth/session')).status; }
      catch { return 0; }
    }), 0, 'Authenticated API responses must not be available from the worker cache');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /offline right now/i })).toBeVisible();
    await expect(page.getByText('Browser Student', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: /AI processing approval/i })).toHaveCount(0);
    await page.screenshot({ path: path.join(artifacts, 'public-offline-mobile.png'), fullPage: true });
    await context.setOffline(false);
    await app.heading(/privacy & account sessions/i);
    await page.getByRole('button', { name: 'Sign out here', exact: true }).click();
    await page.waitForURL(`${origin}/`);
    await context.setOffline(true);
    await app.goto('/privacy');
    await expect(page.getByRole('heading', { name: /offline right now/i })).toBeVisible();
    await context.setOffline(false);
    await page.waitForURL(`${origin}/onboard`);
    assert.deepEqual(errors, [], 'No unhandled offline/reconnection JavaScript errors');
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'offline-failure.png'), fullPage: true }); throw error;
  } finally { await context.close(); }
});

test('teacher review enables server-scored practice, progress and shared-device isolation', { timeout: 120000 }, async () => {
  const question = 'Which synthetic fraction represents one half?';
  await journey('Teacher', async (app, page) => {
    await page.getByRole('button', { name: /curriculum question bank/i }).click();
    await page.getByRole('button', { name: 'Add School Question', exact: true }).click();
    await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Math');
    await page.getByRole('textbox', { name: 'Chapter', exact: true }).fill('Fractions');
    await page.getByRole('textbox', { name: 'Question Text', exact: true }).fill(question);
    await page.getByRole('textbox', { name: 'Option A', exact: true }).fill('1/2');
    await page.getByRole('textbox', { name: 'Option B', exact: true }).fill('1/3');
    await page.getByRole('textbox', { name: 'Correct Answer', exact: true }).fill('A');
    await page.getByRole('textbox', { name: 'Explanation', exact: true }).fill('A half is one of two equal parts.');
    await page.getByRole('button', { name: 'Save for Review', exact: true }).click();
    await page.getByText(question, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByText('✓ Approved', { exact: true }).waitFor();
  });
  await journey('Student', async (app, page) => {
    await app.follow('School Practice', /^school practice$/i);
    await page.getByRole('combobox', { name: 'Practice topic', exact: true }).selectOption({ label: 'Math · Fractions (1 reviewed)' });
    const created = page.waitForResponse((r) => r.url().endsWith('/v2/practice/attempts') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    const payload = await (await created).json();
    assert.equal(payload.result, null);
    assert.deepEqual(Object.keys(payload.questions[0]).sort(), ['id', 'options', 'question_text']);
    await expect(page.getByRole('button', { name: 'Check answers', exact: true })).toBeDisabled();
    await page.getByRole('radio', { name: '1/2', exact: true }).check();
    await page.getByRole('button', { name: 'Check answers', exact: true }).click();
    await page.getByRole('heading', { name: 'Practice result: 1 / 1', exact: true }).waitFor();
    await expect(page.getByRole('status').filter({ hasText: 'Saved to your learning progress.' })).toBeVisible();
    await page.getByText('A half is one of two equal parts.', { exact: true }).waitFor();
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(async () => {
        const box = await page.getByRole('region', { name: 'Teacher-reviewed practice', exact: true }).boundingBox();
        return Boolean(box && box.x >= 0 && box.x + box.width <= width + 1);
      }).toBe(true);
      if (width === 320) {
        const heading = await page.getByRole('heading', { name: 'School practice', exact: true }).boundingBox();
        const menu = await page.getByRole('button', { name: 'Open navigation', exact: true }).boundingBox();
        assert.ok(heading && menu && heading.y >= menu.y + menu.height, 'Practice heading must clear the fixed mobile menu');
      }
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.screenshot({ path: path.join(artifacts, 'reviewed-practice-mobile.png'), fullPage: true });
    await page.getByRole('link', { name: 'View topic mastery', exact: true }).click();
    await app.heading(/subject & topic mastery/i);
    await page.getByText('Fractions', { exact: true }).waitFor();
    await app.goto('/privacy'); await app.heading(/privacy & account sessions/i);
    await page.getByRole('button', { name: 'Sign out here', exact: true }).click();
    await page.waitForURL(`${origin}/`);
    await app.login('Student', 'Browser Classmate');
    await app.goto('/practice'); await app.heading(/^school practice$/i);
    await expect(page.getByRole('heading', { name: /practice result/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
  });
});

test('staff publication enables private diagnostic evidence and recall handling', { timeout: 240000 }, async () => {
  const title = 'Synthetic school diagnostic';
  let versionId, completedId, pendingId;
  await journey('Teacher', async (app, page) => {
    await page.getByRole('button', { name: /curriculum question bank/i }).click();
    for (let i = 1; i <= 6; i++) {
      await page.getByRole('button', { name: 'Add School Question', exact: true }).click();
      await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Math');
      await page.getByRole('textbox', { name: 'Chapter', exact: true }).fill('Diagnostic synthetic foundations');
      await page.getByRole('textbox', { name: 'Question Text', exact: true }).fill(`Synthetic diagnostic ${i}: choose Yes.`);
      await page.getByRole('textbox', { name: 'Option A', exact: true }).fill('Yes');
      await page.getByRole('textbox', { name: 'Option B', exact: true }).fill('No');
      await page.getByRole('textbox', { name: 'Correct Answer', exact: true }).fill('A');
      await page.getByRole('textbox', { name: 'Explanation', exact: true }).fill(`School-reviewed explanation ${i}: Yes is the fixture key.`);
      await page.getByRole('button', { name: 'Save for Review', exact: true }).click();
      await expect(page.getByText(`Synthetic diagnostic ${i}: choose Yes.`, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    }
    await app.goto('/teacher/diagnostics'); await app.heading(/^diagnostic editor$/i);
    await page.getByRole('textbox', { name: 'Assessment title', exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Math');
    await page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add concept', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: `Edit ${title}`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add concept', exact: true }).click();
    let concept = page.getByRole('group', { name: 'Concept: New concept 1', exact: true });
    await concept.getByRole('textbox', { name: 'Concept ID', exact: true }).fill('base');
    await concept.getByRole('textbox', { name: 'Concept label', exact: true }).fill('Foundations');
    concept = page.getByRole('group', { name: 'Concept: Foundations', exact: true });
    for (const i of [1, 2, 3]) await concept.getByRole('checkbox', { name: new RegExp(`Synthetic diagnostic ${i}:`) }).check();
    await page.getByRole('button', { name: 'Add concept', exact: true }).click();
    concept = page.getByRole('group', { name: 'Concept: New concept 1', exact: true });
    await concept.getByRole('textbox', { name: 'Concept ID', exact: true }).fill('next');
    await concept.getByRole('textbox', { name: 'Concept label', exact: true }).fill('Next idea');
    concept = page.getByRole('group', { name: 'Concept: Next idea', exact: true });
    await concept.getByRole('checkbox', { name: 'Review Foundations first', exact: true }).check();
    for (const i of [4, 5, 6]) await concept.getByRole('checkbox', { name: new RegExp(`Synthetic diagnostic ${i}:`) }).check();
    await expect(page.getByRole('button', { name: 'Remove Foundations', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Draft saved/ })).toBeVisible();
    await page.getByRole('button', { name: 'Preview saved draft', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Staff preview', exact: true })).toContainText('School-reviewed explanation 1');
    for (const number of [1, 2]) {
      const published = page.waitForResponse(r => /\/v2\/diagnostics\/blueprints\/\d+\/publish$/.test(r.url()) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Publish assessment', exact: true }).click();
      const response = await published; assert.equal(response.status(), 201); versionId = (await response.json()).id;
      await expect(page.getByRole('status').filter({ hasText: new RegExp(`^Version ${number} published`) })).toBeVisible();
    }
    await page.setViewportSize({ width: 320, height: 800 });
    await page.getByRole('main').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, 'diagnostic-editor-mobile.png'), fullPage: true });
  });
  await journey('Student', async (app, page) => {
    await app.follow('Diagnostics', /^diagnostics$/i);
    const created = page.waitForResponse(r => r.url().endsWith('/v2/diagnostics/attempts') && r.request().method() === 'POST');
    await page.getByRole('button', { name: `Start ${title}`, exact: true }).click();
    const payload = await (await created).json(); completedId = payload.id;
    assert.equal(payload.version_id, versionId); assert.equal(payload.result, null);
    assert.equal(payload.concepts.length, 2);
    for (const concept of payload.concepts) for (const question of concept.questions) assert.deepEqual(Object.keys(question).sort(), ['id', 'options', 'question_text']);
    assert.ok(!JSON.stringify(payload).includes('correct_index') && !JSON.stringify(payload).includes('explanation'));
    await page.getByRole('group', { name: 'Synthetic diagnostic 1: choose Yes.', exact: true }).getByRole('radio', { name: 'No', exact: true }).check();
    await page.reload();
    await expect(page.getByText(/unsent choices are not restored/i)).toBeVisible();
    for (const radio of await page.getByRole('radio').all()) await expect(radio).not.toBeChecked();
    await page.setViewportSize({ width: 320, height: 800 });
    for (const radio of await page.getByRole('radio').all()) {
      const size = await radio.evaluate(element => { const box = element.closest('label').getBoundingClientRect(); return { width: box.width, height: box.height, right: box.right }; });
      assert.ok(size.height >= 44 && size.width >= 44 && size.right <= 321, 'Radio label has a 44px mobile target within the viewport');
    }
    const first = page.getByRole('group', { name: 'Synthetic diagnostic 1: choose Yes.', exact: true });
    await first.getByRole('radio', { name: 'Yes', exact: true }).focus();
    await first.getByRole('radio', { name: 'Yes', exact: true }).press('ArrowDown');
    await expect(first.getByRole('radio', { name: 'No', exact: true })).toBeChecked();
    for (const i of [2, 3, 5]) await page.getByRole('group', { name: `Synthetic diagnostic ${i}: choose Yes.`, exact: true }).getByRole('radio', { name: 'No', exact: true }).check();
    await page.getByRole('group', { name: 'Synthetic diagnostic 4: choose Yes.', exact: true }).getByRole('radio', { name: 'Yes', exact: true }).check();
    await page.getByRole('group', { name: 'Synthetic diagnostic 6: choose Yes.', exact: true }).getByRole('radio', { name: "I'm not sure", exact: true }).check();
    await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
    const result = page.getByRole('region', { name: 'Diagnostic evidence', exact: true });
    await expect(page.getByRole('heading', { name: 'Diagnostic evidence', exact: true })).toBeFocused();
    await expect(result).toContainText('1 correct · 5 answered · 1 skipped · 6 questions');
    await expect(result).toContainText('Review suggested'); await expect(result).toContainText('Insufficient evidence');
    await expect(result.getByRole('group', { name: 'Prerequisites suggesting review', exact: true }).filter({ hasText: 'Foundations' })).toBeVisible();
    await expect(result).toContainText('School-reviewed explanation 6');
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(async () => { const box = await result.boundingBox(); return !!box && box.x >= 0 && box.x + box.width <= width + 1; }).toBe(true);
      assert.equal(await page.getByRole('main').evaluate(element => getComputedStyle(element).overflowY), 'auto');
      if (width === 320) {
        await page.getByRole('main').evaluate(element => { element.scrollTop = 0; });
        const heading = await page.getByRole('heading', { name: 'Diagnostics', exact: true }).boundingBox();
        const menu = await page.getByRole('button', { name: 'Open navigation', exact: true }).boundingBox();
        assert.ok(heading && menu && heading.y >= menu.y + menu.height, 'Diagnostic heading clears the fixed mobile menu');
        await page.screenshot({ path: path.join(artifacts, 'diagnostic-result-mobile.png'), fullPage: true });
      }
    }
    await page.getByRole('button', { name: 'Dark Mode', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    await page.getByRole('main').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, 'diagnostic-result-dark-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Dark Mode', exact: true }).click();
    await page.setViewportSize({ width: 320, height: 320 });
    assert.equal(await page.getByRole('main').evaluate(element => { element.scrollTop = element.scrollHeight; return element.scrollTop > 0; }), true);
    await page.setViewportSize({ width: 1280, height: 900 });
    const started = page.waitForResponse(r => r.url().endsWith('/v2/diagnostics/attempts') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Start a new attempt', exact: true }).click();
    await page.getByRole('button', { name: `Start ${title}`, exact: true }).click();
    pendingId = (await (await started).json()).id; assert.notEqual(pendingId, completedId);
    await journey('Teacher', async (staff, staffPage) => {
      await staff.goto('/teacher/diagnostics'); await staff.heading(/^diagnostic editor$/i);
      await staffPage.getByRole('button', { name: `Edit ${title}`, exact: true }).click();
      await staffPage.getByRole('button', { name: 'Withdraw version', exact: true }).click();
      await expect(staffPage.getByRole('status').filter({ hasText: /^Version 2 withdrawn/ })).toBeVisible();
    });
    for (const group of await page.getByRole('group').filter({ has: page.getByRole('radio', { name: "I'm not sure", exact: true }) }).all()) await group.getByRole('radio', { name: "I'm not sure", exact: true }).check();
    await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(/withdrawn/i);
    await expect(page.getByRole('group', { name: 'Synthetic diagnostic 1: choose Yes.', exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(artifacts, 'diagnostic-withdrawal.png'), fullPage: true });
    await page.getByRole('button', { name: 'Return to assessments', exact: true }).click();
    await expect(page.getByText(/your school has not published/i)).toBeVisible();
    const history = await page.request.get(`${origin}/api/backend/v2/diagnostics/attempts/${completedId}`);
    assert.equal(history.status(), 200); assert.equal((await history.json()).result.correct_count, 1);
    await app.goto('/privacy'); await app.heading(/privacy & account sessions/i);
    await page.getByRole('button', { name: 'Sign out here', exact: true }).click(); await page.waitForURL(`${origin}/`);
    await app.login('Student', 'Browser Classmate');
    await app.goto('/diagnostics'); await app.heading(/^diagnostics$/i);
    await expect(page.getByRole('heading', { name: 'Diagnostic evidence', exact: true })).toHaveCount(0);
    await expect(page.getByText(/your school has not published/i)).toBeVisible();
    for (const id of [completedId, pendingId]) assert.equal((await page.request.get(`${origin}/api/backend/v2/diagnostics/attempts/${id}`)).status(), 404);
  }, [401, 403, 409]);
});

test('staff repairs unavailable selections and clears private content after server denial', { timeout: 150000 }, async () => {
  await journey('Teacher', async (app, page) => {
    await page.getByRole('button', { name: /curriculum question bank/i }).click();
    await page.getByRole('button', { name: 'Add School Question', exact: true }).click();
    await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Math');
    await page.getByRole('textbox', { name: 'Chapter', exact: true }).fill('Diagnostic synthetic foundations');
    await page.getByRole('textbox', { name: 'Question Text', exact: true }).fill('Synthetic diagnostic replacement: choose Yes.');
    await page.getByRole('textbox', { name: 'Option A', exact: true }).fill('Yes');
    await page.getByRole('textbox', { name: 'Option B', exact: true }).fill('No');
    await page.getByRole('textbox', { name: 'Correct Answer', exact: true }).fill('A');
    await page.getByRole('textbox', { name: 'Explanation', exact: true }).fill('School-reviewed replacement explanation.');
    await page.getByRole('button', { name: 'Save for Review', exact: true }).click();
    await expect(page.getByText('Synthetic diagnostic replacement: choose Yes.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);

    await app.goto('/teacher/diagnostics'); await app.heading(/^diagnostic editor$/i);
    const opened = page.waitForResponse(r => /\/v2\/diagnostics\/blueprints\/\d+$/.test(r.url()) && r.request().method() === 'GET');
    await page.getByRole('button', { name: 'Edit Synthetic school diagnostic', exact: true }).click();
    const saved = await (await opened).json();
    const unavailableId = saved.definition.concepts[0].question_ids[0];
    await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled();
    // A changed subject makes existing saved mappings unavailable. Reopen the
    // real server projection, repair the selection, then restore the intended bank.
    await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('No synthetic questions for this subject');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Draft saved/ })).toBeVisible();
    await page.getByRole('button', { name: 'Reload saved draft', exact: true }).click();
    const base = page.getByRole('group', { name: 'Concept: Foundations', exact: true });
    const remove = base.getByRole('button', { name: `Remove selected question ${unavailableId}`, exact: true });
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(base).toContainText('2 of 3 selected');
    await expect(page.getByRole('group', { name: 'Concept: Next idea', exact: true }).getByRole('checkbox', { name: 'Review Foundations first', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Remove Foundations', exact: true })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Math');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Draft saved/ })).toBeVisible();
    await page.getByRole('button', { name: 'Reload saved draft', exact: true }).click();
    await base.getByRole('checkbox', { name: /Synthetic diagnostic replacement:/ }).check();
    await page.getByRole('button', { name: 'Publish assessment', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Version 3 published/ })).toBeVisible();
    await page.getByRole('button', { name: 'Preview saved draft', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Staff preview', exact: true })).toContainText('School-reviewed replacement explanation.');
    await page.screenshot({ path: path.join(artifacts, 'diagnostic-selection-recovery.png'), fullPage: true });

    // Revoke this session through the real account UI in a second tab. The
    // already populated editor must react to server denial before local expiry.
    const account = await page.context().newPage();
    try {
      const accountApp = new BasePage(account, origin);
      await accountApp.goto('/privacy'); await accountApp.heading(/privacy & account sessions/i);
      await account.getByRole('button', { name: 'Sign out here', exact: true }).click();
      await account.waitForURL(`${origin}/`);
      await page.getByRole('button', { name: 'Reload assessment list', exact: true }).click();
      await expect(page.getByRole('main').getByRole('alert')).toContainText(/access.*sign in again/i);
      await expect(page.getByRole('textbox', { name: 'Assessment title', exact: true })).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Staff preview', exact: true })).toHaveCount(0);
      await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.screenshot({ path: path.join(artifacts, 'diagnostic-staff-denial-mobile.png'), fullPage: true });
      await page.getByRole('main').getByRole('link', { name: 'Sign in again', exact: true }).click();
      await app.heading(/sign in to ai sakhi/i);
    } finally { await account.close(); }
  });
});
