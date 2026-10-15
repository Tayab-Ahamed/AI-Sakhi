const assert = require('node:assert/strict');

class BasePage {
  constructor(page, origin) { this.page = page; this.origin = origin; }
  async goto(path) {
    await this.page.goto(`${this.origin}${path}`, { waitUntil: 'domcontentloaded' });
  }
  async heading(name) {
    await this.page.getByRole('heading', { name, level: 1 }).waitFor({ state: 'visible' });
  }
  async login(role, name = `Browser ${role}`) {
    await this.goto(`/login?role=${role.toLowerCase()}`);
    await this.heading(/sign in to ai sakhi/i);
    await this.page.getByRole('textbox', { name: 'Your name', exact: true }).fill(name);
    await this.page.getByRole('textbox', { name: 'Password', exact: true }).fill('Browser-test-only-42!');
    await this.page.getByRole('button', { name: `Sign in as ${role}`, exact: true }).click();
    const homes = { Student: '/chat', Parent: '/parent', Teacher: '/teacher', Admin: '/admin' };
    await this.page.waitForURL(`${this.origin}${homes[role]}`);
    const skip = this.page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.isVisible()) await skip.click();
  }
  async follow(name, heading) {
    const link = this.page.getByRole('link', { name, exact: true });
    const href = await link.getAttribute('href');
    assert.ok(href?.startsWith('/'), `Expected app link for ${name}`);
    await link.click();
    await this.page.waitForURL(`${this.origin}${href}`);
    await this.heading(heading);
  }
}
module.exports = { BasePage };
