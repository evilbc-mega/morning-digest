import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const tempDirs: string[] = [];

const makeRunsDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('returns null for a missing night file', () => {
    expect(readNight(makeRunsDir(), 'missing')).toBeNull();
  });

  it('returns an empty digest for an empty file', () => {
    const dir = makeRunsDir();
    writeFileSync(join(dir, 'empty.jsonl'), '');

    expect(readNight(dir, 'empty')).toEqual({
      rows: [],
      malformedLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('aggregates valid records, skips malformed lines, and keeps original timestamps', () => {
    const dir = makeRunsDir();
    writeFileSync(
      join(dir, 'night.jsonl'),
      [
        JSON.stringify({ at: '2026-11-17T23:00:00-04:00', job: 'deploy', status: 'retry', owner: null, error: 'first error' }),
        '{bad json',
        JSON.stringify({ at: '2026-11-18T01:00:00+02:00', job: 'deploy', status: 'ok', owner: null }),
      ].join('\n'),
    );

    expect(readNight(dir, 'night')).toEqual({
      rows: [{
        job: 'deploy', owner: null, runs: 2, retries: 1, lastStatus: 'ok', lastError: 'first error',
        firstAt: '2026-11-17T23:00:00-04:00', lastAt: '2026-11-18T01:00:00+02:00',
      }],
      malformedLines: 1,
      counts: { ok: 1, retry: 1, fail: 0 },
    });
  });

  it('accepts the checked-in night fixture via a temporary runs directory', () => {
    const dir = makeRunsDir();
    const fixture = readFileSync(new URL('../runs/2026-10-28.jsonl', import.meta.url), 'utf8');
    writeFileSync(join(dir, '2026-10-28.jsonl'), fixture);

    const digest = readNight(dir, '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest?.rows).toHaveLength(5);
    expect(digest?.malformedLines).toBe(1);
    expect(digest?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(digest?.rows.find((row) => row.job === 'digest/render')).toMatchObject({ owner: null });
    expect(digest?.rows.find((row) => row.job === 'lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});
