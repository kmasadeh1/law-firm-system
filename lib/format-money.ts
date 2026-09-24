import { localeTag } from './format-date-time'

// The firm operates in Jordanian dinars only - no currency column exists in
// the schema, every stored amount is implicitly JOD.
export function formatAmount(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return '—'
  const formatter = new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency: 'JOD',
    // JOD natively has 3 decimal places (fils); the app has always shown 2,
    // so this keeps that precision rather than switching to Intl's default.
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // Arabic renders exactly as Intl formats it - د.أ. is correct there.
  // English currency formatting puts the ISO code ("JOD") before the
  // number, which reads like a bank statement; the firm's own convention
  // is "JD" after the number. Rebuilt from formatToParts (not a string
  // replace on the formatted output) so digit grouping, the decimal
  // separator, and the minus sign on a negative amount stay Intl-correct -
  // only the currency part and the literal space next to it are dropped.
  if (locale !== 'ar') {
    const numberOnly = formatter
      .formatToParts(value)
      .filter((part) => part.type !== 'currency' && part.type !== 'literal')
      .map((part) => part.value)
      .join('')
    return `${numberOnly} JD`
  }

  return formatter.format(value)
}

export function formatPercentage(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100)
}
