'use client'

import { useEffect, useId, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from './button'

// Soft: deleted_at is set, restorable. Hard: the row is gone. Deactivate:
// a two-way is_active flip, reversible from the same screen. Each gets its
// own reassurance-or-warning line so the two extremes (restorable vs not)
// never look alike - see cases/actions.ts and owner/staff/actions.ts for
// which call sites are which.
export type DeleteConfirmKind = 'soft' | 'hard' | 'deactivate'

export function DeleteConfirmDialog({
  open,
  onCancel,
  onConfirm,
  kind,
  itemLabel,
  confirmLabel,
  pendingLabel,
  pending = false,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  kind: DeleteConfirmKind
  /** The identifying detail - a filename, a note's first line, a person's
   *  name. Rendered isolated with <bdi>, not forced LTR: this is often a
   *  name, and names aren't LTR data. */
  itemLabel: string
  /** The actual verb: "Delete", "Remove", "Deactivate" - never "OK". */
  confirmLabel: string
  pendingLabel?: string
  pending?: boolean
}) {
  const t = useTranslations('dashboard.common.deleteConfirm')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const headingId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      triggerRef.current = document.activeElement
      if (!dialog.open) dialog.showModal()
      // Cancel, not confirm, is the default focus - the whole point of a
      // confirmation step is that reflex-clicking it should be safe.
      cancelRef.current?.focus()
    } else if (dialog.open) {
      dialog.close()
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
    }
  }, [open])

  // The native `cancel` event fires on Escape before the dialog would close
  // itself. Routing it through the same onCancel the Cancel button uses -
  // rather than letting the browser close the dialog on its own - keeps the
  // caller's `open` state as the single source of truth; our own effect
  // above is what actually calls .close().
  function handleCancel(e: React.SyntheticEvent<HTMLDialogElement>) {
    e.preventDefault()
    onCancel()
  }

  const note = kind === 'soft' ? t('softNote') : kind === 'deactivate' ? t('deactivateNote') : t('hardNote')

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      aria-modal="true"
      role="dialog"
      onCancel={handleCancel}
      className="w-[calc(100%-2rem)] max-w-sm rounded-lg border border-line bg-surface p-0 text-fg shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <h2 id={headingId} className="font-heading text-base text-fg">
            {t.rich('title', {
              verb: confirmLabel,
              item: itemLabel,
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </h2>
          <p className="text-sm text-fg-muted">{note}</p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
