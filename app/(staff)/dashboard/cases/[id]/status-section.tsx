'use client'

import { useState, useTransition } from 'react'
import { setCaseStatus } from '../actions'

type StatusOption = { id: string; name: string; is_terminal: boolean }

export function StatusSection({
  caseId,
  currentStatusId,
  statuses,
}: {
  caseId: string
  currentStatusId: string
  statuses: StatusOption[]
}) {
  const [statusId, setStatusId] = useState(currentStatusId)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const changed = statusId !== currentStatusId

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await setCaseStatus(caseId, statusId)
      if (result.error) {
        setError(result.error)
        setStatusId(currentStatusId)
        return
      }
      setSaved(true)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold text-black dark:text-zinc-50">Status</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="status_id"
          value={statusId}
          onChange={(e) => {
            setStatusId(e.target.value)
            setSaved(false)
          }}
          className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !changed}
          className="rounded-full border border-black/10 px-4 py-2 text-sm text-black transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-50 dark:hover:bg-white/10"
        >
          {isPending ? 'Saving…' : 'Save status'}
        </button>
        {saved && !changed && <span className="text-sm text-green-700 dark:text-green-400">Saved</span>}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
