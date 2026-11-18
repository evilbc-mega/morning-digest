export type DigestStatus = 'ok' | 'retry' | 'fail';

export type StatusCounts = Record<DigestStatus, number>;

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  rows: DigestRow[];
  malformedLines: number;
  counts: StatusCounts;
} | null;

// Returns null when the night file is missing; malformed lines are counted in the result.
export type ReadNight = (runsDir: string, night: string) => NightDigest;
