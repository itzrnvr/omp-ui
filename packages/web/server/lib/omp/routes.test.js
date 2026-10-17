import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { registerOmpRoutes } from './routes.js';

const createRouteRegistry = () => {
  const routes = new Map();
  return {
    app: {
      get(routePath, handler) {
        routes.set(`GET ${routePath}`, handler);
      },
    },
    getRoute(method, routePath) {
      return routes.get(`${method} ${routePath}`);
    },
  };
};

const createResponse = () => {
  const response = { statusCode: 200, body: null };
  return {
    response,
    res: {
      status(code) {
        response.statusCode = code;
        return this;
      },
      json(payload) {
        response.body = payload;
        return this;
      },
    },
  };
};

describe('registerOmpRoutes', () => {
  let ompHome = '';

  beforeEach(() => {
    ompHome = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-routes-'));
    fs.mkdirSync(path.join(ompHome, 'agent', 'sessions'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(ompHome, { recursive: true, force: true });
  });

  const fakeSession = (id, directory, updated) => ({
    id,
    projectID: directory,
    directory,
    title: id,
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: updated, updated },
  });

  it('status reports enabled when the sessions root exists', () => {
    const registry = createRouteRegistry();
    registerOmpRoutes(registry.app, {
      env: {},
      createLister: () => ({ sessionsRoot: path.join(ompHome, 'agent', 'sessions'), listAll: () => [] }),
    });
    const { response, res } = createResponse();
    registry.getRoute('GET', '/api/omp/status')({}, res);
    expect(response.body.enabled).toBe(true);
  });

  it('status reports disabled when OPENCHAMBER_OMP is 0', () => {
    const registry = createRouteRegistry();
    registerOmpRoutes(registry.app, {
      env: { OPENCHAMBER_OMP: '0' },
      createLister: () => ({ sessionsRoot: path.join(ompHome, 'agent', 'sessions'), listAll: () => [] }),
    });
    const { response, res } = createResponse();
    registry.getRoute('GET', '/api/omp/status')({}, res);
    expect(response.body.enabled).toBe(false);
  });

  it('sessions answers newest first and filters by directory', () => {
    const sessions = [
      fakeSession('old', 'C:\\repo\\a', 100),
      fakeSession('new', 'C:\\repo\\b', 300),
      fakeSession('mid', 'C:\\repo\\a', 200),
    ];
    const registry = createRouteRegistry();
    registerOmpRoutes(registry.app, {
      env: {},
      createLister: () => ({ sessionsRoot: ompHome, listAll: () => [...sessions] }),
    });
    const handler = registry.getRoute('GET', '/api/omp/sessions');

    const all = createResponse();
    handler({ query: {} }, all.res);
    expect(all.response.body.sessions.map((session) => session.id)).toEqual(['new', 'mid', 'old']);

    const filtered = createResponse();
    handler({ query: { directory: 'C:\\repo\\a' } }, filtered.res);
    expect(filtered.response.body.sessions.map((session) => session.id)).toEqual(['mid', 'old']);
  });

  it('directory reads inside one TTL window share a single walk', () => {
    let walks = 0;
    let clock = 1000;
    const registry = createRouteRegistry();
    registerOmpRoutes(registry.app, {
      env: {},
      now: () => clock,
      createLister: () => ({
        sessionsRoot: ompHome,
        listAll: () => {
          walks += 1;
          return [fakeSession('s1', 'C:\\repo\\a', 100)];
        },
      }),
    });
    const handler = registry.getRoute('GET', '/api/omp/sessions');
    handler({ query: { directory: 'C:\\repo\\a' } }, createResponse().res);
    handler({ query: { directory: 'C:\\repo\\b' } }, createResponse().res);
    expect(walks).toBe(1);
    clock += 2001;
    handler({ query: {} }, createResponse().res);
    expect(walks).toBe(2);
  });

  it('a repeated directory parameter is a 400, not a silent unfiltered list', () => {
    const registry = createRouteRegistry();
    registerOmpRoutes(registry.app, {
      env: {},
      createLister: () => ({ sessionsRoot: ompHome, listAll: () => [fakeSession('s1', 'C:\\repo\\a', 100)] }),
    });
    const { response, res } = createResponse();
    registry.getRoute('GET', '/api/omp/sessions')({ query: { directory: ['C:\\repo\\a', 'C:\\repo\\b'] } }, res);
    expect(response.statusCode).toBe(400);
  });

  it('a lister failure answers 500, never an empty list', () => {
    const registry = createRouteRegistry();
    registerOmpRoutes(registry.app, {
      env: {},
      createLister: () => ({ sessionsRoot: ompHome, listAll: () => { throw new Error('root gone'); } }),
    });
    const { response, res } = createResponse();
    registry.getRoute('GET', '/api/omp/sessions')({ query: {} }, res);
    expect(response.statusCode).toBe(500);
    expect(response.body.error).toBe('root gone');
  });
});
