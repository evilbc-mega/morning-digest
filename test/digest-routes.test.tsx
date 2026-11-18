import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const expectedJobs = [
  'digest/render',
  'fixtures/refresh',
  'lane/sync',
  'notes/backup',
  'rig/rotate-logs',
];

describe('digest routes', () => {
  let tempDir: string;
  let runsDir: string;
  let config: RigConfig;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    runsDir = join(tempDir, 'runs');
    mkdirSync(runsDir);
    config = {
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('serves the 2026-10-28 fixture as a page and matching sorted JSON despite its bad line', async () => {
    copyFileSync(new URL('../runs/2026-10-28.jsonl', import.meta.url), join(runsDir, '2026-10-28.jsonl'));
    const app = createApp(config);

    const pageResponse = await app.request('/digest/2026-10-28');
    const page = await pageResponse.text();
    expect(pageResponse.status).toBe(200);
    for (const job of expectedJobs) {
      expect(page).toContain(job);
    }
    const pageJobPositions = expectedJobs.map((job) => page.indexOf(job));
    expect(pageJobPositions).toEqual([...pageJobPositions].sort((a, b) => a - b));

    const jsonResponse = await app.request('/api/digest/2026-10-28');
    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.headers.get('content-type')).toContain('application/json');
    const rows = await jsonResponse.json() as { job: string }[];
    expect(rows.map(({ job }) => job)).toEqual(expectedJobs);
  });

  it('returns 404 for a night with no file on both routes', async () => {
    const app = createApp(config);

    const pageResponse = await app.request('/digest/2026-10-30');
    const jsonResponse = await app.request('/api/digest/2026-10-30');

    expect(pageResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('serves both nights linked from the status board', async () => {
    for (const night of ['2026-10-27', '2026-10-28']) {
      copyFileSync(new URL(`../runs/${night}.jsonl`, import.meta.url), join(runsDir, `${night}.jsonl`));
    }
    const app = createApp(config);
    const boardResponse = await app.request('/');
    const board = await boardResponse.text();

    expect(board).toContain('href="/digest/2026-10-27"');
    expect(board).toContain('href="/digest/2026-10-28"');
    for (const night of ['2026-10-27', '2026-10-28']) {
      expect((await app.request(`/digest/${night}`)).status).toBe(200);
    }
  });

  it('renders an empty file as nothing ran and returns an empty JSON digest', async () => {
    writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');
    const app = createApp(config);

    const pageResponse = await app.request('/digest/2026-10-30');
    const page = await pageResponse.text();
    expect(pageResponse.status).toBe(200);
    expect(page).toContain('nothing ran');

    const jsonResponse = await app.request('/api/digest/2026-10-30');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toEqual([]);
  });
});
