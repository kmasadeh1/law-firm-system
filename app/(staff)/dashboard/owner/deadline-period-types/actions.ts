'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

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

function readFields(
  formData: FormData,
  t: Awaited<ReturnType<typeof getTranslations>>
): Fields | { error: string } {
  const name = formData.get('name')
  const name_ar = formData.get('name_ar')
  const period_days_raw = formData.get('period_days')
  const description = formData.get('description')
  const description_ar = formData.get('description_ar')

  if (typeof name !== 'string' || !name.trim()) {
    return { error: t('nameRequired') }
  }
  const period_days = typeof period_days_raw === 'string' ? Number(period_days_raw) : NaN
  if (!Number.isInteger(period_days) || period_days <= 0) {
    return { error: t('invalidDays') }
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
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.periodTypes.errors' })
  const fields = readFields(formData, t)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('deadline_period_types')
    .insert(fields)
    .select('id, name, name_ar, period_days, description, description_ar')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: t('nameExists') }
    }
    return { error: t('createFailed') }
  }

  revalidatePath(PATH)
  return { periodType: data }
}

export async function updatePeriodType(id: string, formData: FormData): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.periodTypes.errors' })
  const fields = readFields(formData, t)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { error } = await supabase.from('deadline_period_types').update(fields).eq('id', id)

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: t('nameExists') }
    }
    return { error: t('saveFailed') }
  }

  revalidatePath(PATH)
  return {}
}

export async function deletePeriodType(id: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.periodTypes.errors' })
  const supabase = await createClient()
  const { error } = await supabase.from('deadline_period_types').delete().eq('id', id)

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: t('inUse') }
    }
    return { error: t('deleteFailed') }
  }

  revalidatePath(PATH)
  return {}
}
