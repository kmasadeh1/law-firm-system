'use client'

import { useState } from 'react'
import { CourtSection, type CourtFiling, type CourtOption, type AppealDeadlinePrefill } from './court-section'
import { DeadlinesSection, type Deadline } from './deadlines-section'
import type { PeriodTypeOption } from '../../deadlines/actions'

// Hearings (inside CourtSection) and the add-deadline form (inside
// DeadlinesSection) are separate sections that both already exist on this
// page - "create appeal deadline" has to hand a trigger_date and a
// source_hearing_id from one to the other after both are already mounted,
// so this thin wrapper is the only place that can hold that shared draft.
export function CourtAndDeadlines({
  caseId,
  filings,
  courts,
  deadlines,
  periodTypes,
  canManage,
}: {
  caseId: string
  filings: CourtFiling[]
  courts: CourtOption[]
  deadlines: Deadline[]
  periodTypes: PeriodTypeOption[]
  canManage: boolean
}) {
  const [triggerDate, setTriggerDate] = useState('')
  const [sourceHearingId, setSourceHearingId] = useState<string | null>(null)

  function handleCreateAppealDeadline(prefill: AppealDeadlinePrefill) {
    setTriggerDate(prefill.trigger_date)
    setSourceHearingId(prefill.source_hearing_id)
  }

  function handleSubmitted() {
    setTriggerDate('')
    setSourceHearingId(null)
  }

  return (
    <>
      <CourtSection
        caseId={caseId}
        filings={filings}
        courts={courts}
        canManage={canManage}
        onCreateAppealDeadline={handleCreateAppealDeadline}
      />

      <DeadlinesSection
        caseId={caseId}
        deadlines={deadlines}
        periodTypes={periodTypes}
        canManage={canManage}
        triggerDate={triggerDate}
        onTriggerDateChange={setTriggerDate}
        sourceHearingId={sourceHearingId}
        onSubmitted={handleSubmitted}
      />
    </>
  )
}
