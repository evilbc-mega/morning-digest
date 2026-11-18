import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { registerDigestApi } from '../src/digest/api.js';
import type { NightDigest } from '../src/digest/types.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '/tmp/runs',
};

const digest: NightDigest = {
  rows: [
    {
      job: 'zeta',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T01:00:00+01:00',
      lastAt: '2026-10-28T01:00:00+01:00',
    },
    {
      job: 'alpha',
      owner: 'ops',
      runs: 2,
      retries: 1,
      lastStatus: 'retry',
      lastError: 'temporary error',
      firstAt: '2026-10-28T01:00:00+01:00',
      lastAt: '2026-10-28T01:01:00+01:00',
    },
  ],
  malformedLines: 0,
  counts: { ok: 1, retry: 1, fail: 0 },
};

describe('digest JSON API', () => {
  it('returns rows sorted by job', async () => {
    const readNight = vi.fn(() => digest);
    const app = new Hono();
    registerDigestApi(app, config, readNight);

    const response = await app.request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect((await response.json()).map((row: { job: string }) => row.job)).toEqual([
      'alpha',
      'zeta',
    ]);
    expect(readNight).toHaveBeenCalledWith('/tmp/runs', '2026-10-28');
    expect(digest.rows[0]?.job).toBe('zeta');
  });

  it('returns 404 when the night is missing', async () => {
    const app = new Hono();
    registerDigestApi(app, config, () => null);

    const response = await app.request('/api/digest/2026-10-29');

    expect(response.status).toBe(404);
  });
});
