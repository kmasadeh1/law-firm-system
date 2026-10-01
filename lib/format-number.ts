import { localeTag } from './format-date-time'

// Plain integer formatting (row counts, pagination) - same Latin-numeral
// convention as every other formatter in this file's siblings
// (format-date-time.ts, format-money.ts): ar-JO-u-nu-latn keeps Arabic
// digits out of what otherwise reads as a count or an index.
export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(localeTag(locale)).format(value)
}
