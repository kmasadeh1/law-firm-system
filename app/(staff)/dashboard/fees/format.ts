// No currency column exists in the schema; the firm operates in Jordanian
// dinars, so amounts are labeled "JD" for display only - nothing stored is
// a currency-typed value.
export function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} JD`
}

export function formatFeeType(feeType: 'fixed' | 'percentage', fixedAmount: number | null, percentage: number | null) {
  return feeType === 'fixed' ? formatAmount(fixedAmount) : `${percentage ?? '—'}%`
}
