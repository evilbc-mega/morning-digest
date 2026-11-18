import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { registerDigestPage } from '../src/digest/page.js';
import type { DigestRow, ReadNight } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'test-runs' };

function row(job: string, overrides: Partial<DigestRow> = {}): DigestRow {
  return {
    job,
    owner: 'ops',
    runs: 1,
    retries: 0,
    lastStatus: 'ok',
    lastError: null,
    firstAt: '2026-10-28T01:00:00+01:00',
    lastAt: '2026-10-28T01:00:00+01:00',
    ...overrides,
  };
}

function appFor(readNight: ReadNight) {
  const app = new Hono();
  registerDigestPage(app, config, readNight);
  return app;
}

describe('digest page', () => {
  it('renders sorted rows in the shared layout and marks retries and failures', async () => {
    const app = appFor(() => ({
      rows: [
        row('zeta'),
        row('alpha', { retries: 3 }),
        row('beta', { lastStatus: 'fail', lastError: 'unavailable' }),
      ],
      malformedLines: 0,
      counts: { ok: 1, retry: 0, fail: 0 },
    }));

    const response = await app.request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('lane-07');
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('beta'));
    expect(html.indexOf('beta')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('<tr class="warn"><td>alpha</td>');
    expect(html).toContain('<tr class="warn"><td>beta</td>');
    expect(html).not.toContain('<tr class="warn"><td>zeta</td>');
  });

  it('returns 404 when the night is missing', async () => {
    const response = await appFor(() => null).request('/digest/unknown');
    expect(response.status).toBe(404);
  });

  it('renders only “nothing ran” inside the page for an empty night', async () => {
    const response = await appFor(() => ({
      rows: [],
      malformedLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    })).request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html.match(/<main>([\s\S]*?)<\/main>/)?.[1]).toBe('nothing ran');
  });
});
