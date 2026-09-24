import { localeTag } from './format-date-time'

// The firm operates in Jordanian dinars only - no currency column exists in
// the schema, every stored amount is implicitly JOD. Intl has no narrow
// symbol for JOD, so it falls back to the ISO code ("JOD") in English and
// the Arabic currency name (د.أ.) in Arabic - both are locale-correct.
export function formatAmount(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency: 'JOD',
    // JOD natively has 3 decimal places (fils); the app has always shown 2,
    // so this keeps that precision rather than switching to Intl's default.
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercentage(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100)
}
