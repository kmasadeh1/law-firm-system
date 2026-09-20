'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type ActionResult = { error?: string }
type EnquiryStatus = Database['public']['Enums']['enquiry_status']

const ENQUIRIES_PATH = '/dashboard/enquiries'

function enquiryPath(id: string) {
  return `${ENQUIRIES_PATH}/${id}`
}

export async function assignEnquiry(enquiryId: string, staffId: string | null): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('enquiries')
    .update({ assigned_to: staffId })
    .eq('id', enquiryId)
    .select('id')

  if (error) {
    return { error: 'Could not save the assignment. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to change this enquiry." }
  }

  revalidatePath(enquiryPath(enquiryId))
  revalidatePath(ENQUIRIES_PATH)
  return {}
}

export async function setEnquiryStatus(enquiryId: string, status: EnquiryStatus): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('enquiries')
    .update({ status })
    .eq('id', enquiryId)
    .select('id')

  if (error) {
    return { error: 'Could not update the status. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to change this enquiry." }
  }

  revalidatePath(enquiryPath(enquiryId))
  revalidatePath(ENQUIRIES_PATH)
  return {}
}
