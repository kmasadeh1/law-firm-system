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

  // Goes through the RPC, never a direct table update - the enquiries
  // UPDATE policy is owner/enquiries_manage only, so an assigned Lawyer's
  // direct update would affect zero rows. set_enquiry_status is the one
  // path that also accepts the assignee, via can_access_enquiry.
  const { error } = await supabase.rpc('set_enquiry_status', {
    p_enquiry_id: enquiryId,
    p_status: status,
  })

  if (error) {
    if (error.code === '42501') {
      return { error: t('noPermissionChange') }
    }
    return { error: t('updateStatusFailed') }
  }

  revalidatePath(enquiryPath(enquiryId))
  revalidatePath(ENQUIRIES_PATH)
  return {}
}

// --- Notes ---------------------------------------------------------------

export async function addEnquiryNote(enquiryId: string, formData: FormData): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.enquiries.detail.notes.errors' })
  const note = formData.get('note')
  if (typeof note !== 'string' || !note.trim()) {
    return { error: t('writeSomething') }
  }

  const supabase = await createClient()

  // enquiry_id and note only - staff_id defaults to auth.uid() at the
  // database level, and a client-sent value would be rejected by RLS
  // anyway (insert requires staff_id = auth.uid()).
  const { error } = await supabase.from('enquiry_notes').insert({
    enquiry_id: enquiryId,
    note: note.trim(),
  })

  if (error) {
    if (error.code === '42501') {
      return { error: t('noPermissionAdd') }
    }
    return { error: t('addFailed') }
  }

  revalidatePath(enquiryPath(enquiryId))
  return {}
}

// deleted_by is stamped (and cleared on restore) by the
// enquiry_notes_stamp_delete trigger - never sent from here.
export async function deleteEnquiryNote(enquiryId: string, noteId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.enquiries.detail.notes.errors' })
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('enquiry_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('enquiry_id', enquiryId)
    .select('id')

  if (error) {
    return { error: t('deleteFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionDelete') }
  }

  revalidatePath(enquiryPath(enquiryId))
  return {}
}

export async function restoreEnquiryNote(enquiryId: string, noteId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.enquiries.detail.notes.errors' })
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('enquiry_notes')
    .update({ deleted_at: null })
    .eq('id', noteId)
    .eq('enquiry_id', enquiryId)
    .select('id')

  if (error) {
    return { error: t('restoreFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionRestore') }
  }

  revalidatePath(enquiryPath(enquiryId))
  return {}
}
