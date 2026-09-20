'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { error?: string }

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

const PATH = '/dashboard/owner/deadline-period-types'

type Fields = {
  name: string
  name_ar: string
  period_days: number
  description: string | null
  description_ar: string
}

function readFields(formData: FormData): Fields | { error: string } {
  const name = formData.get('name')
  const name_ar = formData.get('name_ar')
  const period_days_raw = formData.get('period_days')
  const description = formData.get('description')
  const description_ar = formData.get('description_ar')

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Name is required.' }
  }
  const period_days = typeof period_days_raw === 'string' ? Number(period_days_raw) : NaN
  if (!Number.isInteger(period_days) || period_days <= 0) {
    return { error: 'Enter a whole number of days.' }
  }

  return {
    name: name.trim(),
    // name_ar/description_ar are sent as-is, untrimmed - a database trigger
    // converts '' and whitespace-only input to NULL on insert/update.
    name_ar: typeof name_ar === 'string' ? name_ar : '',
    period_days,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    description_ar: typeof description_ar === 'string' ? description_ar : '',
  }
}

type PeriodTypeRow = {
  id: string
  name: string
  name_ar: string | null
  period_days: number
  description: string | null
  description_ar: string | null
}

export async function createPeriodType(
  formData: FormData
): Promise<ActionResult & { periodType?: PeriodTypeRow }> {
  const fields = readFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('deadline_period_types')
    .insert(fields)
    .select('id, name, name_ar, period_days, description, description_ar')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'A period type with that name already exists.' }
    }
    return { error: 'Could not create the period type. Please try again.' }
  }

  revalidatePath(PATH)
  return { periodType: data }
}

export async function updatePeriodType(id: string, formData: FormData): Promise<ActionResult> {
  const fields = readFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { error } = await supabase.from('deadline_period_types').update(fields).eq('id', id)

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'A period type with that name already exists.' }
    }
    return { error: 'Could not save the changes. Please try again.' }
  }

  revalidatePath(PATH)
  return {}
}

export async function deletePeriodType(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('deadline_period_types').delete().eq('id', id)

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: "Can't delete a period type while a deadline uses it." }
    }
    return { error: 'Could not delete the period type. Please try again.' }
  }

  revalidatePath(PATH)
  return {}
}
