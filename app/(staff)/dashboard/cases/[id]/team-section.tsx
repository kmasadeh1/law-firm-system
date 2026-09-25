'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { addTeamMember, removeTeamMember, setTeamMemberLead, type TeamErrorCode } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Banner } from '@/components/dashboard/banner'
import { FieldError, controlClass } from '@/components/dashboard/form'
import { Badge } from '@/components/dashboard/badge'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'

type TeamMember = { staff_id: string; full_name: string; is_lead: boolean }
type StaffOption = { id: string; full_name: string }

// Closed set the server can return - anything else (there shouldn't be
// anything else) falls back to a generic translated message rather than
// passing an arbitrary value to t() as a key.
const TEAM_ERROR_CODES: TeamErrorCode[] = [
  'already_has_lead',
  'already_on_case',
  'no_permission_change',
  'add_failed',
  'update_failed',
  'remove_failed',
  'no_permission_remove',
]

export function TeamSection({
  caseId,
  team,
  availableStaff,
}: {
  caseId: string
  team: TeamMember[]
  availableStaff: StaffOption[]
}) {
  const t = useTranslations('dashboard.cases.detail.team')
  const tErrors = useTranslations('dashboard.cases.detail.team.errors')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [addStaffId, setAddStaffId] = useState('')
  const [addAsLead, setAddAsLead] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState<TeamMember | null>(null)

  const hasLead = team.some((m) => m.is_lead)
  const candidates = availableStaff.filter((s) => !team.some((m) => m.staff_id === s.id))

  function runAction(fn: () => Promise<{ error?: TeamErrorCode }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.error) {
        setError((TEAM_ERROR_CODES as string[]).includes(result.error) ? tErrors(result.error) : tErrors('generic'))
      }
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-team-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      {!hasLead && (
        <Banner kind="warning">
          <bdi>{t('noLeadWarning')}</bdi>
        </Banner>
      )}

      {team.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('nobodyAssigned')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {team.map((m) => (
            <li key={m.staff_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-fg">
                {m.full_name}
                {m.is_lead && (
                  <Badge variant="accent">
                    <bdi>{t('lead')}</bdi>
                  </Badge>
                )}
              </span>
              <span className="flex gap-3">
                {m.is_lead ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => runAction(() => setTeamMemberLead(caseId, m.staff_id, false))}
                  >
                    <bdi>{t('removeAsLead')}</bdi>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => runAction(() => setTeamMemberLead(caseId, m.staff_id, true))}
                  >
                    <bdi>{t('makeLead')}</bdi>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger"
                  disabled={isPending}
                  onClick={() => setConfirmingRemove(m)}
                >
                  {t('remove')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <FieldError>
          <bdi>{error}</bdi>
        </FieldError>
      )}

      {candidates.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="add-staff" className="text-sm text-fg-muted">
              {t('addToTeam')}
            </label>
            <select
              id="add-staff"
              value={addStaffId}
              onChange={(e) => setAddStaffId(e.target.value)}
              className={controlClass}
            >
              <option value="">{t('selectStaff')}</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-sm text-fg-muted">
            <input type="checkbox" checked={addAsLead} onChange={(e) => setAddAsLead(e.target.checked)} />
            <bdi>{t('asLead')}</bdi>
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
            {t('add')}
          </Button>
        </div>
      )}

      <DeleteConfirmDialog
        open={confirmingRemove !== null}
        onCancel={() => setConfirmingRemove(null)}
        onConfirm={() => {
          if (!confirmingRemove) return
          const staffId = confirmingRemove.staff_id
          setConfirmingRemove(null)
          runAction(() => removeTeamMember(caseId, staffId))
        }}
        kind="hard"
        itemLabel={confirmingRemove?.full_name ?? ''}
        confirmLabel={t('remove')}
      />
    </Panel>
  )
}
