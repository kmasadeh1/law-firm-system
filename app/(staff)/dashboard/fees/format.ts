// No currency is defined anywhere in the schema, so amounts are formatted
// as plain numbers (thousands separator, 2 decimals) rather than guessing
// a currency symbol.
export function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatFeeType(feeType: 'fixed' | 'percentage', fixedAmount: number | null, percentage: number | null) {
  return feeType === 'fixed' ? formatAmount(fixedAmount) : `${percentage ?? '—'}%`
}
