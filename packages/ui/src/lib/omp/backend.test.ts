import { describe, expect, test } from "bun:test"

import { readOmpStatusEnabled } from "./backend"

describe("readOmpStatusEnabled", () => {
  test("a parsable status decides", () => {
    expect(readOmpStatusEnabled(JSON.stringify({ enabled: true, sessionsRoot: "/home/u/.omp/agent/sessions" }))).toBe(true)
    expect(readOmpStatusEnabled(JSON.stringify({ enabled: false, sessionsRoot: "/home/u/.omp/agent/sessions" }))).toBe(false)
  })

  test("an unparsable or failed status means not OMP, never a crash", () => {
    expect(readOmpStatusEnabled("not json")).toBe(false)
    expect(readOmpStatusEnabled(JSON.stringify({ enabled: "yes" }))).toBe(false)
    expect(readOmpStatusEnabled(JSON.stringify({ enabled: true }))).toBe(false)
  })
})
