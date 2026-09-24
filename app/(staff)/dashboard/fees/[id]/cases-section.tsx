'use client'

import { useState, useTransition } from 'react'
import { linkCase, unlinkCase } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { FieldError, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'

type CaseRow = { id: string; case_number: string; title: string }

export function CasesSection({
  engagementId,
  clientId,
  linkedCases,
  clientCases,
}: {
  engagementId: string
  clientId: string
  linkedCases: CaseRow[]
  clientCases: CaseRow[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [addCaseId, setAddCaseId] = useState('')
  const [confirmingUnlink, setConfirmingUnlink] = useState<CaseRow | null>(null)

  const candidates = clientCases.filter((c) => !linkedCases.some((l) => l.id === c.id))

  function runAction(fn: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.error) setError(result.error)
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">Linked cases</h2>

      {linkedCases.length === 0 ? (
        <p className="text-sm text-fg-muted">No cases linked yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {linkedCases.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="text-fg">
                <bdi>{c.case_number}</bdi> — {c.title}
              </span>
              <Button
                type="button"
                variant="danger"
                disabled={isPending}
                onClick={() => setConfirmingUnlink(c)}
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && <FieldError>{error}</FieldError>}

      {candidates.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="add-case" className="text-sm text-fg-muted">
              Link a case
            </label>
            <select
              id="add-case"
              value={addCaseId}
              onChange={(e) => setAddCaseId(e.target.value)}
              className={controlClass}
            >
              <option value="">Select a case…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} — {c.title}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || !addCaseId}
            onClick={() =>
              runAction(async () => {
                const result = await linkCase(engagementId, clientId, addCaseId)
                if (!result.error) setAddCaseId('')
                return result
              })
            }
          >
            Link
          </Button>
        </div>
      )}

      <DeleteConfirmDialog
        open={confirmingUnlink !== null}
        onCancel={() => setConfirmingUnlink(null)}
        onConfirm={() => {
          if (!confirmingUnlink) return
          const caseId = confirmingUnlink.id
          setConfirmingUnlink(null)
          runAction(() => unlinkCase(engagementId, caseId))
        }}
        kind="hard"
        itemLabel={
          confirmingUnlink ? (
            <>
              <bdi>{confirmingUnlink.case_number}</bdi> — <bdi>{confirmingUnlink.title}</bdi>
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Unlink"
        pendingLabel="Unlinking…"
        pending={isPending}
        note="The case and the engagement both stay - only the connection between them is removed."
      />
    </Panel>
  )
}
