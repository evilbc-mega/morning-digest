export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: 'ok' | 'retry' | 'fail';
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  rows: DigestRow[];
  malformedLines: number;
} | null;

// Returns null when the night file is missing; malformed lines are counted in the result.
export declare function readNight(runsDir: string, night: string): NightDigest;
