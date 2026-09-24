import { formatAmount, formatPercentage } from '@/lib/format-money'

export function formatFeeType(
  feeType: 'fixed' | 'percentage',
  fixedAmount: number | null,
  percentage: number | null,
  locale: string
) {
  return feeType === 'fixed' ? formatAmount(fixedAmount, locale) : formatPercentage(percentage, locale)
}
