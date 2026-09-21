// Arabic locale tag used for every date/time formatter below. Plain 'ar' (or
// 'ar-JO') renders Arabic-Indic digits (٢٠٢٦/٠٩/٢١); appending
// '-u-nu-latn' keeps Arabic month/weekday names and RTL layout but forces
// Latin digits (2026/09/21). Court filings, case numbers, and invoices
// commonly expect Latin digits even in Arabic text, so this defaults to
// Latin numerals. Flip this one constant to switch the whole firm.
const AR_LOCALE_TAG = 'ar-JO-u-nu-latn'

function localeTag(locale: string) {
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
