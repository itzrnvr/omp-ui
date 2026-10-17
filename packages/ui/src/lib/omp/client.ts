/**
 * The OMP half of the session list seam.
 *
 * `listOmpSessionsPage` answers the same `SessionPage` shape the OpenCode
 * client answers, from the OpenChamber-owned `/api/omp/sessions` route. The
 * server returns the whole list in one page, so the cursor is terminal and
 * the paging loop in `stores/globalSessions.ts` stops after it.
 */

import { runtimeFetch } from "../runtime-fetch"
import type { SessionListOptions, SessionPage } from "../opencode/client"
import { ompSessionPageWireSchema } from "./session-wire"

export const listOmpSessionsPage = async (options: SessionListOptions = {}): Promise<SessionPage> => {
  const response = await runtimeFetch("/api/omp/sessions", {
    query: options.directory ? { directory: options.directory } : undefined,
  })
  if (!response.ok) {
    throw new Error(`OMP session list failed with status ${response.status}`)
  }
  const payload = ompSessionPageWireSchema.parse(await response.json())
  return { sessions: payload.sessions, cursor: {} }
}
