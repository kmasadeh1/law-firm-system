'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import type { Database } from '@/lib/supabase/database.types'

type ActionResult = { error?: string }
type EnquiryStatus = Database['public']['Enums']['enquiry_status']

const ENQUIRIES_PATH = '/dashboard/enquiries'

function enquiryPath(id: string) {
  return `${ENQUIRIES_PATH}/${id}`
}

export async function assignEnquiry(enquiryId: string, staffId: string | null): Promise<ActionResult> {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.enquiries.errors' })

  const { data, error } = await supabase
    .from('enquiries')
    .update({ assigned_to: staffId })
    .eq('id', enquiryId)
    .select('id')

  if (error) {
    return { error: t('saveAssignmentFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionChange') }
  }

  revalidatePath(enquiryPath(enquiryId))
  revalidatePath(ENQUIRIES_PATH)
  return {}
}

export async function setEnquiryStatus(enquiryId: string, status: EnquiryStatus): Promise<ActionResult> {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.enquiries.errors' })

  const { data, error } = await supabase
    .from('enquiries')
    .update({ status })
    .eq('id', enquiryId)
    .select('id')

  if (error) {
    return { error: t('updateStatusFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionChange') }
  }

  revalidatePath(enquiryPath(enquiryId))
  revalidatePath(ENQUIRIES_PATH)
  return {}
}
