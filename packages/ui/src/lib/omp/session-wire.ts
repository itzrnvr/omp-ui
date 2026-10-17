/**
 * Wire schema for the OMP session page the server serves.
 *
 * The server projects `~/.omp` session heads into the OpenChamber domain
 * shape, but a response is still bytes until it is parsed here. The schema
 * mirrors exactly what `server/lib/omp/routes.js` sends; anything else is a
 * failure, not an empty page.
 */

import { z } from "zod"

const ompTokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
  reasoning: z.number(),
  cache: z.object({ read: z.number(), write: z.number() }),
})

const ompSessionWireSchema = z.object({
  id: z.string(),
  parentID: z.string().optional(),
  projectID: z.string(),
  directory: z.string(),
  title: z.string(),
  cost: z.number(),
  tokens: ompTokenUsageSchema,
  time: z.object({ created: z.number(), updated: z.number() }),
})

export const ompSessionPageWireSchema = z.object({
  sessions: z.array(ompSessionWireSchema),
})

export const ompStatusWireSchema = z.object({
  enabled: z.boolean(),
  sessionsRoot: z.string(),
})
