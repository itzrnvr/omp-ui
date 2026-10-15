/**
 * Schema for the head of an OMP session file.
 *
 * `~/.omp/agent/sessions/<encoded-cwd>/<ts>_<id>.jsonl` is JSON lines. Line
 * one is a `title` record, line two a `session` record, and the rest of the
 * file is the transcript. Only the head matters for a list row, and a
 * session file can exceed 100MB, so the transcript is never read here.
 *
 * OMP writes the session record with and without `title`, `titleSource`,
 * `parentSession` and `providerPromptCacheKey`, and older files carry no
 * title record at all. Every field beyond `type` is optional so a future
 * record revision parses instead of throwing.
 */

import { z } from "zod"

const titleRecordSchema = z.object({
  type: z.literal("title"),
  title: z.string().optional(),
})

const sessionRecordSchema = z.object({
  type: z.literal("session"),
  id: z.string(),
  cwd: z.string(),
  timestamp: z.string(),
  title: z.string().optional(),
  parentSession: z.string().optional(),
})

const headRecordSchema = z.union([titleRecordSchema, sessionRecordSchema])

/**
 * Parses one line of a session file head. Returns `null` for a line that is
 * not JSON or is not a record this reader understands, so one unexpected
 * line never hides the records around it.
 */export const parseOmpHeadRecord = (line: string) => {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  const result = headRecordSchema.safeParse(parsed)
  return result.success ? result.data : null
}
