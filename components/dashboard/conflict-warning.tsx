'use client'

import { useTranslations } from 'next-intl'
import { Button } from './button'

/**
 * Shared warn-and-confirm UI for the conflict-check flow (clients, case
 * opposing parties): a possible-duplicate list with "create anyway" /
 * "edit details instead" actions. Match labels are resolved by the caller
 * since what counts as a good label differs slightly by context.
 *
 * labels is ReactNode[], not string[], so a caller can <bdi>-wrap the
 * matched value (a name is data, isolated from the surrounding sentence
 * the same way case-detail's opposing-parties matches now are).
 */
export function ConflictWarning({
  labels,
  onConfirm,
  onEdit,
  pending,
  confirmLabel,
}: {
  labels: React.ReactNode[]
  onConfirm: () => void
  onEdit: () => void
  pending: boolean
  confirmLabel?: string
}) {
  const t = useTranslations('dashboard.conflict')

  return (
    <div className="rounded-md border border-accent-border/50 bg-accent-border/10 p-4 text-sm">
      <p className="font-medium text-fg">{t('possibleMatch', { count: labels.length })}</p>
      <ul className="mt-2 list-disc ps-5 text-fg-muted">
        {labels.map((label, i) => (
          <li key={i}>{label}</li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-4">
        <Button type="button" variant="primary" onClick={onConfirm} disabled={pending}>
          {pending ? t('saving') : (confirmLabel ?? t('createAnyway'))}
        </Button>
        <Button type="button" variant="ghost" onClick={onEdit} disabled={pending}>
          {t('editDetailsInstead')}
        </Button>
      </div>
    </div>
  )
}
