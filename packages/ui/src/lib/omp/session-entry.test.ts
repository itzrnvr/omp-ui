import { describe, expect, test } from "bun:test"

import { projectOmpSessionFile } from "./session-entry"

// Header lines copied verbatim from live ~/.omp session files
// (~/.omp/agent/sessions/<encoded-cwd>/*.jsonl). The sidebar lists from the
// file head only: a 100MB session must never be fully read for a list row.
const titledHead = [
  `{"type":"title","v":1,"title":"Explain node and asar calls","source":"auto","updatedAt":"2026-10-14T19:14:54.190Z","pad":""}`,
  `{"type":"session","version":3,"id":"01a13bd6-c86e-7000-adcd-b7db7b529a2a","title":"Explain node and asar calls","titleSource":"auto","timestamp":"2026-10-14T19:14:54.190Z","cwd":"C:\\\\Users\\\\babys\\\\tmp","parentSession":"01a13605-786c-7000-b5f1-6d68f95f6609"}`,
]

const untitledHead = [
  `{"type":"session","version":3,"id":"019e023e-db55-7000-a545-9262bacb93ba","timestamp":"2026-05-07T11:42:14.357Z","cwd":"C:\\\\tmp"}`,
]

describe("projectOmpSessionFile", () => {
  test("lifts cwd, title, and parent onto the domain session", () => {
    const session = projectOmpSessionFile({ lines: titledHead, mtimeMs: 1792100000000 })
    expect(session?.id).toBe("01a13bd6-c86e-7000-adcd-b7db7b529a2a")
    expect(session?.directory).toBe("C:\\Users\\babys\\tmp")
    expect(session?.title).toBe("Explain node and asar calls")
    expect(session?.parentID).toBe("01a13605-786c-7000-b5f1-6d68f95f6609")
  })

  test("an untitled session gets an empty title rather than undefined", () => {
    const session = projectOmpSessionFile({ lines: untitledHead, mtimeMs: 1792100000000 })
    expect(session?.title).toBe("")
    expect("parentID" in (session ?? {})).toBe(false)
  })

  test("created comes from the session record, updated from the file mtime", () => {
    const session = projectOmpSessionFile({ lines: titledHead, mtimeMs: 1792100000000 })
    expect(session?.time.created).toBe(Date.parse("2026-10-14T19:14:54.190Z"))
    expect(session?.time.updated).toBe(1792100000000)
  })

  test("an unparseable head is null, never an empty session", () => {
    expect(projectOmpSessionFile({ lines: ["not json"], mtimeMs: 0 })).toBeNull()
    expect(projectOmpSessionFile({ lines: [], mtimeMs: 0 })).toBeNull()
  })
})
