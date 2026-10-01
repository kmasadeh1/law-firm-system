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
