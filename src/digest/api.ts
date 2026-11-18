import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import type { ReadNight } from './types.js';

export function registerDigestApi(app: Hono, config: RigConfig, readNight: ReadNight): void {
  app.get('/api/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));

    if (!digest) {
      return c.notFound();
    }

    const rows = [...digest.rows].sort((a, b) => a.job.localeCompare(b.job));
    return c.json(rows);
  });
}
