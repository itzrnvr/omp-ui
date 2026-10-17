/**
 * OMP session routes.
 *
 * `GET /api/omp/status` reports whether the OMP backend is live: the
 * sessions root exists and `OPENCHAMBER_OMP` is not `0`. The UI asks once at
 * boot and reads its session list from OMP only when this says enabled, so
 * an install without `~/.omp` keeps the OpenCode path untouched.
 *
 * `GET /api/omp/sessions` answers the full list, newest first, optionally
 * filtered by `?directory=`. A missing sessions root is a 500, never an
 * empty list: the caller must not read a failure as "no sessions".
 */
import fs from 'node:fs';

import { z } from 'zod';

import { createOmpSessionLister } from './session-lister.js';

const sessionsQuerySchema = z.object({ directory: z.string().optional() });

export const registerOmpRoutes = (app, deps = {}) => {
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => Date.now());
  const createLister = deps.createLister ?? createOmpSessionLister;
  let lister = null;
  const getLister = () => {
    if (lister === null) lister = createLister();
    return lister;
  };

  // A refresh fans out one read per known directory, and every read walks
  // the whole sessions root. One shared walk per TTL window keeps a batch
  // of directory reads at the cost of one.
  const LIST_CACHE_TTL_MS = 2000;
  let cache = null;
  const readSessions = () => {
    const at = now();
    if (cache !== null && at - cache.at < LIST_CACHE_TTL_MS) return cache.sessions;
    const sessions = getLister().listAll();
    cache = { at, sessions };
    return sessions;
  };

  app.get('/api/omp/status', (_req, res) => {
    const root = getLister().sessionsRoot;
    const enabled = env.OPENCHAMBER_OMP !== '0' && fs.existsSync(root);
    res.json({ enabled, sessionsRoot: root });
  });

  app.get('/api/omp/sessions', (req, res) => {
    const query = sessionsQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: 'directory must be a single string' });
      return;
    }
    const directory = query.data.directory;
    let sessions;
    try {
      sessions = readSessions();
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      res.status(500).json({ error: message });
      return;
    }
    if (directory !== undefined) {
      sessions = sessions.filter((session) => session.directory === directory);
    }
    sessions.sort((left, right) => right.time.updated - left.time.updated);
    res.json({ sessions });
  });
};
