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
  note,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  kind: DeleteConfirmKind
  /** The identifying detail - a filename, a note's first line, a person's
   *  name. Rendered isolated with <bdi>, not forced LTR: this is often a
   *  name, and names aren't LTR data. A plain string is wrapped in one
   *  <bdi> as a whole; when the detail is a composite of several values
   *  (an amount and a date, a case number and a title), pass a ReactNode
   *  with each value isolated individually instead - bundling them into
   *  one string first would isolate the whole run together and lose the
   *  per-value boundary the values need from each other. */
  itemLabel: React.ReactNode
  /** The actual verb: "Delete", "Remove", "Deactivate", "Revoke",
   *  "Unlink" - never "OK". */
  confirmLabel: string
  pendingLabel?: string
  pending?: boolean
  /** Overrides the generic kind-derived reassurance/warning line when the
   *  actual consequence needs saying precisely - e.g. "the client holding
   *  this link will no longer be able to open it" instead of a generic
   *  "can't be undone". Sourced from the caller's own namespace, since the
   *  wording is specific to that action, not shared. Falls back to the
   *  kind-derived default when omitted. */
  note?: React.ReactNode
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

  const defaultNote = kind === 'soft' ? t('softNote') : kind === 'deactivate' ? t('deactivateNote') : t('hardNote')
  const noteContent = note ?? defaultNote

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
              // A plain string gets the dialog's own <bdi>; a caller that
              // already composed itemLabel as several individually-isolated
              // pieces (an amount and a date, a case number and a title) is
              // rendered as-is instead of bundling everything into one
              // isolate, which would lose the boundary between those pieces.
              item: () => (typeof itemLabel === 'string' ? <bdi>{itemLabel}</bdi> : itemLabel),
            })}
          </h2>
          <p className="text-sm text-fg-muted">{noteContent}</p>
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
