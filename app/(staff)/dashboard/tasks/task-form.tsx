'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { createTask, type TaskErrorCode, type TaskPriority } from './actions'
import { CasePicker } from './case-picker'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

type StaffOption = { id: string; full_name: string }

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high']

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

// Shared between the standalone Tasks page and the case detail page's
// Tasks section - fixedCaseId skips the search picker entirely and sends a
// hidden, un-editable case_id instead, so a task created from a case page
// is pinned to that case rather than offering a second way to pick one.
export function TaskForm({
  fixedCaseId,
  staffOptions,
}: {
  fixedCaseId?: string
  staffOptions: StaffOption[]
}) {
  const t = useTranslations('dashboard.tasks.form')
  const tPriority = useTranslations('dashboard.tasks.priority')
  const tErrors = useTranslations('dashboard.tasks.form.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resolveError(code: TaskErrorCode) {
    return (TASK_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('addFailed')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createTask(formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onChange={() => setError(null)} className="flex flex-col gap-3" data-testid="task-form">
      {fixedCaseId ? <input type="hidden" name="case_id" value={fixedCaseId} /> : <CasePicker />}

      <Field>
        <Label htmlFor="task-title" required>
          {t('titleLabel')}
        </Label>
        <input id="task-title" name="title" required className={controlClass} />
      </Field>

      <Field>
        <Label htmlFor="task-details">{t('detailsLabel')}</Label>
        <textarea id="task-details" name="details" rows={2} className={controlClass} />
      </Field>

      <div className="flex flex-wrap gap-3">
        <Field>
          <Label htmlFor="task-assignee" required>
            {t('assigneeLabel')}
          </Label>
          <select id="task-assignee" name="assigned_to" required defaultValue="" className={controlClass}>
            <option value="" disabled>
              {t('selectAssigneePlaceholder')}
            </option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <Label htmlFor="task-due">{t('dueDateLabel')}</Label>
          <input id="task-due" name="due_date" type="date" className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="task-priority">{t('priorityLabel')}</Label>
          <select id="task-priority" name="priority" defaultValue="normal" className={controlClass}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {tPriority(p)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" variant="primary" data-testid="task-add-button" disabled={isPending} className="self-start">
        {isPending ? t('adding') : t('add')}
      </Button>
    </form>
  )
}
