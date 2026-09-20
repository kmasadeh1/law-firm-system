// Generic before/after diffing for an activity_log row's old_data/new_data -
// entity-specific "what does this mean" sentences are the shared labels'
// job (lib/activity-labels.ts); this only answers "what fields changed."

export type FieldDiff = { field: string; before: unknown; after: unknown }

function isEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function diffFields(
  action: 'insert' | 'update' | 'delete',
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): FieldDiff[] {
  if (action === 'insert') {
    return Object.entries(newData ?? {})
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([field, value]) => ({ field, before: undefined, after: value }))
  }

  if (action === 'delete') {
    return Object.entries(oldData ?? {})
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([field, value]) => ({ field, before: value, after: undefined }))
  }

  const fields = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])
  const diffs: FieldDiff[] = []
  for (const field of fields) {
    const before = oldData?.[field]
    const after = newData?.[field]
    if (!isEqual(before, after)) {
      diffs.push({ field, before, after })
    }
  }
  return diffs
}

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      }
    }
    return value
  }
  if (typeof value === 'number') return String(value)
  return JSON.stringify(value)
}
