'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

export type ConflictMatch = {
  source: string
  matched_id: string
  matched_name: string
  case_id: string | null
}

type ClientFields = {
  full_name: string
  national_id: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

async function readFields(formData: FormData): Promise<ClientFields | { error: string }> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.form.errors' })

  const full_name = formData.get('full_name')
  if (typeof full_name !== 'string' || !full_name.trim()) {
    return { error: t('fullNameRequired') }
  }

  const optional = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  return {
    full_name: full_name.trim(),
    national_id: optional('national_id'),
    phone: optional('phone'),
    email: optional('email'),
    notes: optional('notes'),
  }
}

export async function createClientRecord(
  formData: FormData,
  confirmed: boolean
): Promise<{ error?: string; matches?: ConflictMatch[]; clientId?: string }> {
  const fields = await readFields(formData)
  if ('error' in fields) return fields

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.form.errors' })
  const supabase = await createClient()

  if (!confirmed) {
    const { data: matches, error: conflictError } = await supabase.rpc('check_conflict', {
      p_name: fields.full_name,
      p_national_id: fields.national_id ?? undefined,
    })

    if (conflictError) {
      return { error: t('conflictCheckFailed') }
    }
    if (matches && matches.length > 0) {
      return { matches }
    }
  }

  const { data: user } = await supabase.auth.getClaims()

  const { data: inserted, error } = await supabase
    .from('clients')
    .insert({ ...fields, created_by: user?.claims?.sub })
    .select('id')
    .single()

  if (error) {
    return { error: t('createFailed') }
  }

  revalidatePath('/dashboard/clients')
  return { clientId: inserted.id }
}

export async function updateClientRecord(
  clientId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const fields = await readFields(formData)
  if ('error' in fields) return fields

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.form.errors' })
  const supabase = await createClient()
  const { error } = await supabase.from('clients').update(fields).eq('id', clientId)

  if (error) {
    return { error: t('saveFailed') }
  }

  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${clientId}`)
  return {}
}
