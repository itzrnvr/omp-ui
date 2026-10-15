/**
 * Server-side listing of OMP sessions from `~/.omp/agent/sessions`.
 *
 * OMP keeps every session as one JSON-lines file under a directory named
 * after the encoded working directory. There is no server to ask, so the
 * list comes from the file heads. A session file can be larger than 100MB,
 * so only the head is read: the `title` record and the `session` record.
 *
 * `listAll` throws when the sessions root is missing. A directory that
 * cannot be read is a failure the caller must see, not an empty list.
 */
import fs from 'node:fs';
import path from 'node:path';

import { parseOmpHeadRecord } from './session-file-schema.js';
import { resolveOmpHome } from './omp-home.js';

/**
 * Bytes read per file. The `title` and `session` records sit in the first
 * two lines and a title record stays well under 4KB, so a larger buffer
 * only costs allocation and UTF-8 decode time.
 */
const HEAD_BYTES = 4 * 1024;

/** One buffer reused for every read, so a large listing allocates once. */
const headBuffer = Buffer.alloc(HEAD_BYTES);

const readHeadWithStat = (filePath) => {
  // One open: the mtime comes from the same descriptor as the head read, so
  // a file that vanishes between readdir and open fails loudly rather than
  // being listed without a timestamp.
  const handle = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(handle);
    const read = fs.readSync(handle, headBuffer, 0, HEAD_BYTES, 0);
    return {
      lines: headBuffer.toString('utf8', 0, read).split('\n').filter((line) => line.length > 0),
      mtimeMs: stat.mtimeMs,
    };
  } finally {
    fs.closeSync(handle);
  }
};

const projectHead = (lines, mtimeMs) => {
  let title = '';
  let session = null;

  for (const line of lines) {
    const record = parseOmpHeadRecord(line);
    if (record === null) continue;
    if (record.type === 'title') {
      if (session === null && record.title !== undefined) title = record.title;
      continue;
    }
    const created = Date.parse(record.timestamp);
    if (Number.isNaN(created)) return null;
    session = {
      id: record.id,
      // OMP has no project records; the working directory is the grouping key.
      projectID: record.cwd,
      directory: record.cwd,
      title,
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created, updated: mtimeMs },
    };
    if (record.title !== undefined) session.title = record.title;
    if (record.parentSession !== undefined) session.parentID = record.parentSession;
    break;
  }

  return session;
};

const listDirectory = (directoryPath) => {
  const sessions = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      sessions.push(...listDirectory(entryPath));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    let head;
    try {
      head = readHeadWithStat(entryPath);
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }
    const session = projectHead(head.lines, head.mtimeMs);
    if (session !== null) sessions.push(session);
  }
  return sessions;
};

/**
 * Resolves the OMP home directory from an override, then `OMP_HOME`, then
 * the user's home. A value that is present but empty means "unset",
 * matching how the CLI reads an empty environment variable.
 */
export const createOmpSessionLister = ({ ompHome } = {}) => {
  const sessionsRoot = path.join(resolveOmpHome(ompHome, process.env), 'agent', 'sessions');
  return {
    sessionsRoot,
    listAll() {
      if (!fs.existsSync(sessionsRoot)) {
        throw new Error(`OMP sessions root is missing: ${sessionsRoot}`);
      }
      return listDirectory(sessionsRoot);
    },
  };
};
