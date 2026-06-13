import { describe, expect, it } from "vitest"

import { delayMinutesToSeconds, secondsToDelayMinutes } from "@/config/delayMinutes"

describe("delay minute conversion", () => {
  it("accepts tenths of a minute", () => {
    expect(delayMinutesToSeconds("0.1")).toBe(6)
    expect(delayMinutesToSeconds("1.5")).toBe(90)
  })

  it("rounds arbitrary input to the nearest tenth of a minute", () => {
    expect(delayMinutesToSeconds("1.24")).toBe(72)
    expect(delayMinutesToSeconds("1.25")).toBe(78)
  })

  it("clamps invalid and negative values to zero", () => {
    expect(delayMinutesToSeconds("")).toBe(0)
    expect(delayMinutesToSeconds("not a number")).toBe(0)
    expect(delayMinutesToSeconds("-0.5")).toBe(0)
  })

  it("formats seconds as minutes with at most one decimal place", () => {
    expect(secondsToDelayMinutes(60)).toBe("1")
    expect(secondsToDelayMinutes(90)).toBe("1.5")
    expect(secondsToDelayMinutes(91)).toBe("1.5")
  })
})
