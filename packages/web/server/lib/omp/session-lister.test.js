import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createOmpSessionLister } from './session-lister.js';

/**
 * The lister reads a real directory tree under `~/.omp/agent/sessions` on
 * disk, so these tests write one and read it back rather than mocking fs.
 * A session file head is line 1 `title`, line 2 `session`.
 */
describe('createOmpSessionLister', () => {
  let ompHome = '';
  let sessionsRoot = '';
  let encodedCwd = '';

  const writeSessionFile = (name, lines) => {
    fs.writeFileSync(path.join(sessionsRoot, encodedCwd, name), lines.join('\n') + '\n', 'utf8');
  };

  beforeEach(() => {
    ompHome = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-home-'));
    sessionsRoot = path.join(ompHome, 'agent', 'sessions');
    encodedCwd = '--C--repo-app--';
    fs.mkdirSync(path.join(sessionsRoot, encodedCwd), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(ompHome, { recursive: true, force: true });
  });

  it('reads the head of every session file under the sessions root', () => {
    writeSessionFile('b.jsonl', [
      JSON.stringify({ type: 'title', v: 1, title: 'Second', source: 'auto', updatedAt: '2026-10-15T00:00:00.000Z' }),
      JSON.stringify({
        type: 'session',
        version: 3,
        id: 'ses_b',
        title: 'Second',
        timestamp: '2026-10-15T00:00:00.000Z',
        cwd: 'C:\\repo\\app',
      }),
    ]);
    writeSessionFile('a.jsonl', [
      JSON.stringify({
        type: 'session',
        version: 3,
        id: 'ses_a',
        timestamp: '2026-10-14T00:00:00.000Z',
        cwd: 'C:\\repo\\app',
        parentSession: 'ses_parent',
      }),
    ]);

    const list = createOmpSessionLister({ ompHome });
    const sessions = list.listAll();

    expect(sessions.map((session) => session.id).sort()).toEqual(['ses_a', 'ses_b']);
    const a = sessions.find((session) => session.id === 'ses_a');
    expect(a.title).toBe('');
    expect(a.parentID).toBe('ses_parent');
    expect(a.directory).toBe('C:\\repo\\app');
    const b = sessions.find((session) => session.id === 'ses_b');
    expect(b.title).toBe('Second');
  });

  it('skips a file whose head has no session record', () => {
    writeSessionFile('bad.jsonl', ['not json', JSON.stringify({ type: 'message', id: 'x' })]);
    const list = createOmpSessionLister({ ompHome });
    expect(list.listAll()).toEqual([]);
  });

  it('fails when the sessions root is missing instead of reporting an empty list', () => {
    fs.rmSync(sessionsRoot, { recursive: true, force: true });
    const list = createOmpSessionLister({ ompHome });
    expect(() => list.listAll()).toThrow();
  });
});
