/**
 * Whether the active runtime serves OMP sessions.
 *
 * The server owns the decision (`/api/omp/status`): the sessions root exists
 * and `OPENCHAMBER_OMP` is not `0`. The UI asks once per runtime and caches
 * the answer; a runtime switch clears it and asks again, because the answer
 * belongs to the endpoint, not to the browser.
 *
 * A failed or unparsable status read means "not OMP", so a runtime without
 * the route keeps the OpenCode path instead of failing the session list.
 */

import { runtimeFetch } from "../runtime-fetch"
import { subscribeRuntimeEndpointChanged } from "../runtime-switch"
import { ompStatusWireSchema } from "./session-wire"

let detected: boolean | null = null

/**
 * The decision half of status handling, kept pure so the contract is
 * testable without a transport: a parsable status decides, anything else
 * means "not OMP" so a runtime without the route keeps the OpenCode path.
 */
export const readOmpStatusEnabled = (body: string): boolean => {
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return false
  }
  const parsed = ompStatusWireSchema.safeParse(payload)
  return parsed.success ? parsed.data.enabled : false
}

export const isOmpBackend = (): boolean => detected === true

export const detectOmpBackend = async (): Promise<boolean> => {
  try {
    const response = await runtimeFetch("/api/omp/status")
    detected = response.ok ? readOmpStatusEnabled(await response.text()) : false
  } catch {
    detected = false
  }
  return detected
}

/** Re-detects after a runtime switch, where the cached answer no longer applies. */
export const watchOmpBackend = (): (() => void) =>
  subscribeRuntimeEndpointChanged(() => {
    detected = null
    void detectOmpBackend()
  })
