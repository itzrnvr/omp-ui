/**
 * Projection of OMP (`~/.omp`) session file heads into the OpenChamber
 * domain model.
 *
 * Only the file head is read: the first `title` record and the first
 * `session` record. A session file can exceed 100MB, so listing never reads
 * past the head. `mtimeMs` is the file mtime and feeds `time.updated`;
 * per-message usage arrives later through message records.
 */

import { parseOmpHeadRecord } from "./session-file-schema"
import { compact, type Session } from "../opencode/model"

export type OmpSessionFileInput = {
  /** Head lines of a `~/.omp/agent/sessions/<encoded-cwd>/*.jsonl` file. */
  lines: string[]
  /** File mtime in epoch millis. */
  mtimeMs: number
}

export function projectOmpSessionFile({ lines, mtimeMs }: OmpSessionFileInput): Session | null {
  let title = ""
  let session: Session | null = null

  for (const line of lines) {
    const record = parseOmpHeadRecord(line)
    if (record === null) continue
    if (record.type === "title") {
      // The session record's own title wins; this only fills a session that
      // carries none of its own.
      if (session === null && record.title !== undefined) title = record.title
      continue
    }
    const created = Date.parse(record.timestamp)
    if (Number.isNaN(created)) return null
    session = compact({
      id: record.id,
      parentID: record.parentSession,
      // OMP has no project records; the working directory is the grouping key.
      projectID: record.cwd,
      directory: record.cwd,
      title,
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created, updated: mtimeMs },
    })
    if (record.title !== undefined) session.title = record.title
    break
  }

  return session
}
