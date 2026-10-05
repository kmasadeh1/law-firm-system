// Arabic locale tag used for every date/time formatter below. Plain 'ar' (or
// 'ar-JO') renders Arabic-Indic digits (٢٠٢٦/٠٩/٢١); appending
// '-u-nu-latn' keeps Arabic month/weekday names and RTL layout but forces
// Latin digits (2026/09/21). Court filings, case numbers, and invoices
// commonly expect Latin digits even in Arabic text, so this defaults to
// Latin numerals. Flip this one constant to switch the whole firm.
const AR_LOCALE_TAG = 'ar-JO-u-nu-latn'

export function localeTag(locale: string) {
  return locale === 'ar' ? AR_LOCALE_TAG : 'en'
}

export function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(localeTag(locale), { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(localeTag(locale), { dateStyle: 'medium' })
}

export function formatFullDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(localeTag(locale), { dateStyle: 'full' })
}

export function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(localeTag(locale), { timeStyle: 'short' })
}

// For a bare Postgres `time` value ("14:30:00"), which isn't a valid Date
// string on its own - working_hours.start_time/end_time, not a timestamp.
export function formatTimeOfDay(time: string, locale: string) {
  const [hours, minutes] = time.split(':')
  return new Date(1970, 0, 1, Number(hours), Number(minutes)).toLocaleTimeString(localeTag(locale), {
    timeStyle: 'short',
  })
}

// The firm's own zone - what a <input type="datetime-local"> value means.
// Converting through this (not the host's zone) keeps a typed "14:30"
// meaning 14:30 in Amman whether the server runs on UTC or not, and keeps
// the server-rendered default value identical to the hydrated one.
export const FIRM_TIME_ZONE = 'Asia/Amman'

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
