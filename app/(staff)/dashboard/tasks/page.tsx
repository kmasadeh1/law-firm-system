import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { TaskForm } from './task-form'
import { TaskList, type Task } from './task-list'
import { dashboardTitle } from '@/lib/page-title'

export default async function TasksPage({ searchParams }: PageProps<'/dashboard/tasks'>) {
  const { show } = (await searchParams) as { show?: string }
  const showAll = show === 'all'

  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.tasks.list' })
  const tCommon = await getTranslations({ locale, namespace: 'dashboard.common' })

  const [{ data: canAssign }, { data: activeStaff }, { data: allStaff }, { data: taskRows }] = await Promise.all([
    // STABLE, already true for the owner internally - resolved once here,
    // never OR'd with isOwner.
    supabase.rpc('can_assign_tasks'),
    supabase.from('staff_directory').select('id, full_name').eq('is_active', true).order('full_name'),
    // Unfiltered - an assignee or creator who has since left the firm
    // should still show their name on an old task.
    supabase.from('staff_directory').select('id, full_name'),
    // RLS already limits this to owner/assignee/creator rows - the only
    // filter added here is status, exactly the one the task allows.
    supabase
      .from('tasks')
      .select(
        'id, title, details, case_id, assigned_to, due_date, status, priority, created_by, cases(case_number, title)'
      )
      .in('status', showAll ? ['open', 'in_progress', 'done', 'cancelled'] : ['open', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ])

  const nameById = new Map(
    (allStaff ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )
  const activeStaffOptions = (activeStaff ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )

  const tasks: Task[] = (taskRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    details: row.details,
    case_id: row.case_id,
    case_number: row.cases?.case_number ?? null,
    case_title: row.cases?.title ?? null,
    assigned_to: row.assigned_to,
    assignee_name: nameById.get(row.assigned_to) ?? tCommon('unknownStaff'),
    due_date: row.due_date,
    status: row.status,
    priority: row.priority,
    created_by: row.created_by,
    creator_name: nameById.get(row.created_by) ?? tCommon('unknownStaff'),
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />

      <Link
        href={showAll ? '/dashboard/tasks' : '/dashboard/tasks?show=all'}
        className="self-start text-xs text-fg-muted underline-offset-2 hover:underline"
      >
        {showAll ? t('showActiveOnly') : t('showAll')}
      </Link>

      <Panel className="p-0">
        <TaskList tasks={tasks} />
      </Panel>

      {canAssign === true && (
        <Panel className="flex flex-col gap-3">
          <h2 className="font-heading text-lg text-fg">{t('assignHeading')}</h2>
          <TaskForm staffOptions={activeStaffOptions} />
        </Panel>
      )}
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('tasks')
