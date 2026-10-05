'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { setTaskStatus, type TaskErrorCode, type TaskPriority, type TaskStatus } from './actions'
import { Badge } from '@/components/dashboard/badge'
import { FieldError, controlClass } from '@/components/dashboard/form'
import { formatDate, todayInFirmZone } from '@/lib/format-date-time'

export type Task = {
  id: string
  title: string
  details: string | null
  case_id: string | null
  case_number: string | null
  case_title: string | null
  assigned_to: string
  assignee_name: string
  due_date: string | null
  status: TaskStatus
  priority: TaskPriority
  created_by: string
  creator_name: string
}

const STATUSES: TaskStatus[] = ['open', 'in_progress', 'done', 'cancelled']

const priorityVariant: Record<TaskPriority, 'muted' | 'neutral' | 'accent'> = {
  low: 'muted',
  normal: 'neutral',
  high: 'accent',
}

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const TASK_ERROR_CODES: TaskErrorCode[] = [
  'titleRequired',
  'titleBlank',
  'selectAssignee',
  'statusMismatch',
  'noPermissionAssign',
  'noPermissionUpdate',
  'addFailed',
  'updateFailed',
]

// Display formatting over stored values only - no status column for this,
// no SQL filter. A done or cancelled task is never "overdue" no matter how
// old its due date is.
function isOverdue(task: Pick<Task, 'due_date' | 'status'>): boolean {
  if (!task.due_date) return false
  if (task.status === 'done' || task.status === 'cancelled') return false
  // Both are 'YYYY-MM-DD'; compared as strings against today in Amman,
  // not the host's (or browser's) own date.
  return task.due_date < todayInFirmZone()
}

function StatusSelect({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const t = useTranslations('dashboard.tasks.status')
  const tErrors = useTranslations('dashboard.tasks.form.errors')
  const [value, setValue] = useState(status)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resolveError(code: TaskErrorCode) {
    return (TASK_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('updateFailed')
  }

  function handleChange(next: TaskStatus) {
    const previous = value
    setError(null)
    setValue(next)
    startTransition(async () => {
      const result = await setTaskStatus(taskId, next)
      if (result.error) {
        setValue(previous)
        setError(resolveError(result.error))
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value as TaskStatus)}
        data-testid={`task-status-${taskId}`}
        className={controlClass}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(s)}
          </option>
        ))}
      </select>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

function TaskRow({ task, showCaseLine }: { task: Task; showCaseLine: boolean }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.tasks.list')
  const tPriority = useTranslations('dashboard.tasks.priority')
  const overdue = isOverdue(task)
  const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>

  return (
    <li className="flex flex-col gap-2 px-3 py-3 text-sm" data-testid={`task-${task.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{task.title}</span>
          <Badge variant={priorityVariant[task.priority]}>{tPriority(task.priority)}</Badge>
          {overdue && <Badge variant="accent">{t('overdue')}</Badge>}
        </div>
        <StatusSelect taskId={task.id} status={task.status} />
      </div>

      {task.details && <p className="text-fg-muted">{task.details}</p>}

      <div className="flex flex-wrap gap-3 text-xs text-fg-muted">
        <span>{t.rich('assignedToLine', { name: task.assignee_name, bdi })}</span>
        {task.created_by !== task.assigned_to && (
          <span>{t.rich('createdByLine', { name: task.creator_name, bdi })}</span>
        )}
        {task.due_date && <span>{t.rich('dueLine', { date: formatDate(task.due_date, locale), bdi })}</span>}
        {showCaseLine && task.case_id && (
          <span>
            {t.rich('onCaseLine', { caseNumber: task.case_number ?? '', title: task.case_title ?? '', bdi })}
          </span>
        )}
      </div>
    </li>
  )
}

export function TaskList({ tasks, showCaseLine = true }: { tasks: Task[]; showCaseLine?: boolean }) {
  const t = useTranslations('dashboard.tasks.list')

  if (tasks.length === 0) {
    return <p className="px-3 py-3 text-sm text-fg-muted">{t('noneYet')}</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} showCaseLine={showCaseLine} />
      ))}
    </ul>
  )
}
