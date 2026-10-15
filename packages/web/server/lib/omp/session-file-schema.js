/**
 * Zod schemas for the head of an OMP session file.
 *
 * The UI parses these; the server lister imports the same module through
 * the `@/` alias so one schema owns both sides of the boundary.
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

export const parseOmpHeadRecord = (line) => {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  const result = headRecordSchema.safeParse(parsed);
  return result.success ? result.data : null;
};
