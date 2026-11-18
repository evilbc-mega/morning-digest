import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, ReadNight } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

const isRunRecord = (value: unknown): value is RunRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.at === 'string' &&
    typeof record.job === 'string' &&
    (record.status === 'ok' || record.status === 'retry' || record.status === 'fail') &&
    (typeof record.owner === 'string' || record.owner === null) &&
    (record.error === undefined || typeof record.error === 'string')
  );
};

const emptyCounts = () => ({ ok: 0, retry: 0, fail: 0 });

export const readNight: ReadNight = (runsDir, night) => {
  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const rows = new Map<string, DigestRow>();
  const counts = emptyCounts();
  let malformedLines = 0;
  const lines = contents.split(/\r?\n/);

  // A final newline terminates the last JSONL record; it is not an extra blank record.
  if (lines.at(-1) === '') lines.pop();

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }

    if (!isRunRecord(parsed)) {
      malformedLines += 1;
      continue;
    }

    counts[parsed.status] += 1;
    const existing = rows.get(parsed.job);
    if (existing) {
      existing.runs += 1;
      if (parsed.status === 'retry') existing.retries += 1;
      existing.lastStatus = parsed.status;
      existing.lastAt = parsed.at;
      if (parsed.error) existing.lastError = parsed.error;
    } else {
      rows.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error || null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
    }
  }

  return { rows: [...rows.values()], malformedLines, counts };
};
