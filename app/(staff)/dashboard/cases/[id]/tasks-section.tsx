import { getTranslations } from 'next-intl/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { Panel } from '@/components/dashboard/panel'
import { TaskForm } from '../../tasks/task-form'
import { TaskList, type Task } from '../../tasks/task-list'

type StaffOption = { id: string; full_name: string }

// Same form and list as the standalone Tasks page (imported directly, not
// reimplemented) - this case's tasks are just that same data pre-filtered
// to one case_id, and a task created here pins to this case via
// TaskForm's fixedCaseId rather than offering the search picker again.
export async function TasksSection({
  caseId,
  tasks,
  staffOptions,
  canAssign,
}: {
  caseId: string
  tasks: Task[]
  staffOptions: StaffOption[]
  canAssign: boolean
}) {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.tasks.list' })

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-tasks-section">
      <h2 className="font-heading text-lg text-fg">{t('caseSectionHeading')}</h2>
      <TaskList tasks={tasks} showCaseLine={false} />
      {canAssign && <TaskForm fixedCaseId={caseId} staffOptions={staffOptions} />}
    </Panel>
  )
}
