'use client'

import { useState, useTransition } from 'react'
import { addTeamMember, removeTeamMember, setTeamMemberLead } from '../actions'

type TeamMember = { staff_id: string; full_name: string; is_lead: boolean }
type StaffOption = { id: string; full_name: string }

export function TeamSection({
  caseId,
  team,
  availableStaff,
}: {
  caseId: string
  team: TeamMember[]
  availableStaff: StaffOption[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [addStaffId, setAddStaffId] = useState('')
  const [addAsLead, setAddAsLead] = useState(false)

  const hasLead = team.some((m) => m.is_lead)
  const candidates = availableStaff.filter((s) => !team.some((m) => m.staff_id === s.id))

  function runAction(fn: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold text-black dark:text-zinc-50">Team</h2>

      {!hasLead && (
        <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          No lead lawyer assigned yet - only the owner can close this case until one is set.
        </p>
      )}

      {team.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nobody is assigned yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 rounded-md border border-black/10 dark:divide-white/10 dark:border-white/10">
          {team.map((m) => (
            <li key={m.staff_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="text-black dark:text-zinc-50">
                {m.full_name}
                {m.is_lead && (
                  <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">
                    Lead
                  </span>
                )}
              </span>
              <span className="flex gap-3">
                {m.is_lead ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => runAction(() => setTeamMemberLead(caseId, m.staff_id, false))}
                    className="text-sm text-zinc-500 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Remove as lead
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => runAction(() => setTeamMemberLead(caseId, m.staff_id, true))}
                    className="text-sm text-zinc-500 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Make lead
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => runAction(() => removeTeamMember(caseId, m.staff_id))}
                  className="text-sm text-red-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {candidates.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="add-staff" className="text-sm text-zinc-500 dark:text-zinc-400">
              Add to team
            </label>
            <select
              id="add-staff"
              value={addStaffId}
              onChange={(e) => setAddStaffId(e.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
            >
              <option value="">Select staff…</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-sm text-zinc-500 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={addAsLead}
              onChange={(e) => setAddAsLead(e.target.checked)}
            />
            as lead
          </label>
          <button
            type="button"
            data-testid="team-add-button"
            disabled={isPending || !addStaffId}
            onClick={() =>
              runAction(async () => {
                const result = await addTeamMember(caseId, addStaffId, addAsLead)
                if (!result.error) {
                  setAddStaffId('')
                  setAddAsLead(false)
                }
                return result
              })
            }
            className="rounded-full border border-black/10 px-4 py-2 text-sm text-black transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
