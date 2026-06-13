/// <reference types="office-js" />

import { promisify } from "./officeAsync"

type DelayDeliveryTimeLike = {
  getAsync(callback: (result: Office.AsyncResult<Date | 0>) => void): void
}

type MessageWithDelayDelivery = {
  readonly delayDeliveryTime?: DelayDeliveryTimeLike | null
}

/**
 * True when Outlook has a future delivery time on the draft.
 *
 * Mail Lookout intentionally skips its review flow for scheduled sends:
 * resending later with sendAsync can drop Outlook's scheduled-delivery
 * intent, so scheduled delivery must stay entirely in Outlook's flow.
 */
export async function hasScheduledDelivery(
  item: MessageWithDelayDelivery,
  now = Date.now(),
): Promise<boolean> {
  const delayDeliveryTime = item.delayDeliveryTime
  if (!delayDeliveryTime) {
    return false
  }

  const deliveryTime = await promisify<Date | 0>(callback => delayDeliveryTime.getAsync(callback))
  return deliveryTime instanceof Date && deliveryTime.getTime() > now
}
