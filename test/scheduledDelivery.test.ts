import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { hasScheduledDelivery } from "@/office/scheduledDelivery"

function itemWithDeliveryTime(
  value: Date | 0,
  status: Office.AsyncResultStatus = Office.AsyncResultStatus.Succeeded,
) {
  return {
    delayDeliveryTime: {
      getAsync(callback: (result: Office.AsyncResult<Date | 0>) => void): void {
        callback({
          status,
          value,
          error:
            status === Office.AsyncResultStatus.Failed
              ? { message: "delay lookup failed" }
              : undefined,
        } as Office.AsyncResult<Date | 0>)
      },
    },
  }
}

describe("hasScheduledDelivery", () => {
  beforeEach(() => {
    vi.stubGlobal("Office", {
      AsyncResultStatus: {
        Succeeded: "succeeded",
        Failed: "failed",
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("detects a future scheduled delivery time", async () => {
    const item = itemWithDeliveryTime(new Date("2026-06-15T10:00:00.000Z"))

    await expect(hasScheduledDelivery(item, Date.parse("2026-06-15T09:00:00.000Z"))).resolves.toBe(
      true,
    )
  })

  it("does not treat an unset delivery time as scheduled", async () => {
    await expect(hasScheduledDelivery(itemWithDeliveryTime(0))).resolves.toBe(false)
  })

  it("does not treat a past delivery time as scheduled", async () => {
    const item = itemWithDeliveryTime(new Date("2026-06-15T08:00:00.000Z"))

    await expect(hasScheduledDelivery(item, Date.parse("2026-06-15T09:00:00.000Z"))).resolves.toBe(
      false,
    )
  })

  it("treats missing delayDeliveryTime support as not scheduled", async () => {
    await expect(hasScheduledDelivery({})).resolves.toBe(false)
  })

  it("rejects when Outlook cannot read the delivery time", async () => {
    await expect(
      hasScheduledDelivery(itemWithDeliveryTime(0, Office.AsyncResultStatus.Failed)),
    ).rejects.toThrow("delay lookup failed")
  })
})
