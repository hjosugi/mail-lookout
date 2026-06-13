const SECONDS_PER_MINUTE = 60
const TENTHS_PER_MINUTE = 10
const SECONDS_PER_TENTH_MINUTE = SECONDS_PER_MINUTE / TENTHS_PER_MINUTE

export function delayMinutesToSeconds(raw: string): number {
  const minutes = Number(raw)
  if (!Number.isFinite(minutes)) {
    return 0
  }

  const tenths = Math.max(0, Math.round(minutes * TENTHS_PER_MINUTE))
  return tenths * SECONDS_PER_TENTH_MINUTE
}

export function secondsToDelayMinutes(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds / SECONDS_PER_TENTH_MINUTE))
  const minutes = tenths / TENTHS_PER_MINUTE
  return Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1)
}
