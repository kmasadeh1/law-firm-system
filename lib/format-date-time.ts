// Arabic locale tag used for every date/time formatter below. Plain 'ar' (or
// 'ar-JO') renders Arabic-Indic digits (٢٠٢٦/٠٩/٢١); appending
// '-u-nu-latn' keeps Arabic month/weekday names and RTL layout but forces
// Latin digits (2026/09/21). Court filings, case numbers, and invoices
// commonly expect Latin digits even in Arabic text, so this defaults to
// Latin numerals. Flip this one constant to switch the whole firm.
const AR_LOCALE_TAG = 'ar-JO-u-nu-latn'

// The firm's own zone. Every wall-clock time in this app - an appointment
// at 10:00, "today", a datetime-local value - means Amman time, whatever
// zone the code happens to run in (Vercel runs UTC; a laptop in Amman
// doesn't, which is exactly why relying on the host zone looks fine in
// development and is three hours off in production). Every formatter and
// converter in this file passes it explicitly; nothing here may fall back
// to the host's zone.
export const FIRM_TIME_ZONE = 'Asia/Amman'

export function localeTag(locale: string) {
  return locale === 'ar' ? AR_LOCALE_TAG : 'en'
}

// Accepts a timestamptz ISO string, or a bare 'YYYY-MM-DD' date column
// value (parsed as UTC midnight, which is the same calendar day in Amman,
// UTC+3, so a date never shifts).
export function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(localeTag(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: FIRM_TIME_ZONE,
  })
}

export function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(localeTag(locale), { dateStyle: 'medium', timeZone: FIRM_TIME_ZONE })
}

export function formatFullDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(localeTag(locale), { dateStyle: 'full', timeZone: FIRM_TIME_ZONE })
}

export function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(localeTag(locale), { timeStyle: 'short', timeZone: FIRM_TIME_ZONE })
}

// For a bare Postgres `time` value ("14:30:00"), which isn't a valid Date
// string on its own - working_hours.start_time/end_time, hearings'
// session_time. It's already a wall-clock time with no zone, so it is built
// and formatted in UTC on purpose: no conversion happens on any host.
export function formatTimeOfDay(time: string, locale: string) {
  const [hours, minutes] = time.split(':')
  return new Date(Date.UTC(1970, 0, 1, Number(hours), Number(minutes))).toLocaleTimeString(localeTag(locale), {
    timeStyle: 'short',
    timeZone: 'UTC',
  })
}

// Today's calendar date in Amman, as 'YYYY-MM-DD' - the shape of a date
// column and of an <input type="date"> value. en-CA formats as YYYY-MM-DD.
export function todayInFirmZone(now: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FIRM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// 'YYYY-MM-DD' plus n calendar days. Pure calendar arithmetic in UTC, so no
// host zone or DST can move the result.
export function addDaysToDate(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// The UTC instants bounding one Amman calendar day, for filtering a
// timestamptz column by "this day": start inclusive, end exclusive. Null
// if the date isn't a real 'YYYY-MM-DD'.
export function firmDayBounds(date: string): { start: string; end: string } | null {
  // The start is validated first: addDaysToDate throws on a non-date, and
  // this can be handed a raw URL parameter.
  const start = fromFirmDateTimeInput(`${date}T00:00`)
  if (!start) return null
  const end = fromFirmDateTimeInput(`${addDaysToDate(date, 1)}T00:00`)
  return end ? { start, end } : null
}

// Offset of FIRM_TIME_ZONE from UTC at a given instant, in ms.
function firmZoneOffsetMs(utcMs: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FIRM_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

// timestamptz ISO -> "YYYY-MM-DDTHH:mm" wall-clock in the firm's zone, for
// a datetime-local input's value.
export function toFirmDateTimeInput(iso: string) {
  const utcMs = new Date(iso).getTime()
  return new Date(utcMs + firmZoneOffsetMs(utcMs)).toISOString().slice(0, 16)
}

// "YYYY-MM-DDTHH:mm" wall-clock in the firm's zone -> UTC ISO string, or
// null if the value isn't a well-formed datetime-local value.
export function fromFirmDateTimeInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, mo, d, h, mi] = match.map(Number)
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi)
  // Date.UTC rolls 2026-02-30 over into March - reject instead.
  if (new Date(wallAsUtc).toISOString().slice(0, 16) !== value) return null
  // Re-check the offset at the resulting instant, in case it sits across a
  // zone transition from the first guess.
  const first = wallAsUtc - firmZoneOffsetMs(wallAsUtc)
  return new Date(wallAsUtc - firmZoneOffsetMs(first)).toISOString()
}

// A datetime-local value moved by a number of minutes, staying in Amman
// wall-clock terms (e.g. "end = start + 1 hour"). Returns the input
// unchanged if it isn't a well-formed value.
export function shiftFirmDateTimeInput(value: string, minutes: number) {
  const iso = fromFirmDateTimeInput(value)
  if (!iso) return value
  return toFirmDateTimeInput(new Date(new Date(iso).getTime() + minutes * 60_000).toISOString())
}
