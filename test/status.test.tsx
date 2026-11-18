import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createApp } from '../src/app.js';
import type { ReadNight } from '../src/digest/types.js';
import { readStatus } from '../src/status.js';
import { StatusBoard } from '../src/views/status.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('href="/digest/2026-10-28"');
  });

  it('links each night and shows the reader counts for every status', async () => {
    const readNight: ReadNight = (_runsDir, night) => ({
      rows: [],
      malformedLines: 0,
      // Counts are run-log records, so retry attempts are included by the shared reader.
      counts: night === '2026-10-28'
        ? { ok: 2, retry: 3, fail: 1 }
        : { ok: 4, retry: 0, fail: 0 },
    });
    const board = new Hono();
    board.get('/', (c) => c.html(<StatusBoard status={readStatus(config, readNight)} />));

    const res = await board.request('/');
    const html = await res.text();

    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('ok 2');
    expect(html).toContain('retry 3');
    expect(html).toContain('fail 1');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok 4');
    expect(html).toContain('retry 0');
    expect(html).toContain('fail 0');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
