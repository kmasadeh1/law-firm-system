'use client'

import { useState, useTransition } from 'react'
import { addTeamMember, removeTeamMember, setTeamMemberLead } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Banner } from '@/components/dashboard/banner'
import { FieldError, controlClass } from '@/components/dashboard/form'
import { Badge } from '@/components/dashboard/badge'

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
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">Team</h2>

      {!hasLead && (
        <Banner kind="warning">
          No lead lawyer assigned yet - only the owner can close this case until one is set.
        </Banner>
      )}

      {team.length === 0 ? (
        <p className="text-sm text-fg-muted">Nobody is assigned yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {team.map((m) => (
            <li key={m.staff_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-fg">
                {m.full_name}
                {m.is_lead && <Badge variant="accent">Lead</Badge>}
              </span>
              <span className="flex gap-3">
                {m.is_lead ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => runAction(() => setTeamMemberLead(caseId, m.staff_id, false))}
                  >
                    Remove as lead
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => runAction(() => setTeamMemberLead(caseId, m.staff_id, true))}
                  >
                    Make lead
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger"
                  disabled={isPending}
                  onClick={() => runAction(() => removeTeamMember(caseId, m.staff_id))}
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <FieldError>{error}</FieldError>}

      {candidates.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="add-staff" className="text-sm text-fg-muted">
              Add to team
            </label>
            <select
              id="add-staff"
              value={addStaffId}
              onChange={(e) => setAddStaffId(e.target.value)}
              className={controlClass}
            >
              <option value="">Select staff…</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-sm text-fg-muted">
            <input type="checkbox" checked={addAsLead} onChange={(e) => setAddAsLead(e.target.checked)} />
            as lead
          </label>
          <Button
            type="button"
            variant="secondary"
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
          >
            Add
          </Button>
        </div>
      )}
    </Panel>
  )
}
