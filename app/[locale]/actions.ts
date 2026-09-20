'use server'

import { createClient } from '@/lib/supabase/server'

type SubmitEnquiryResult = { error?: string }

const NAME_MAX = 200
const MESSAGE_MAX = 5000
const PHONE_MAX = 40
const EMAIL_MAX = 320

export async function submitEnquiry(formData: FormData): Promise<SubmitEnquiryResult> {
  // Honeypot: real visitors never see or fill this field (see contact-form.tsx).
  // A bot that fills every input gets a normal-looking success with nothing
  // written - reporting the rejection back would teach it to stop filling
  // this one field, which defeats the point.
  const honeypot = formData.get('website')
  if (typeof honeypot === 'string' && honeypot.trim()) {
    return {}
  }

  const name = formData.get('name')
  const phoneRaw = formData.get('phone')
  const emailRaw = formData.get('email')
  const message = formData.get('message')

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'name_required' }
  }
  if (typeof message !== 'string' || !message.trim()) {
    return { error: 'message_required' }
  }
  const phone = typeof phoneRaw === 'string' && phoneRaw.trim() ? phoneRaw.trim() : null
  const email = typeof emailRaw === 'string' && emailRaw.trim() ? emailRaw.trim() : null
  if (!phone && !email) {
    return { error: 'contact_required' }
  }
  if (name.trim().length > NAME_MAX || message.trim().length > MESSAGE_MAX) {
    return { error: 'generic' }
  }
  if ((phone && phone.length > PHONE_MAX) || (email && email.length > EMAIL_MAX)) {
    return { error: 'generic' }
  }

  const supabase = await createClient()

  // No .select() - anon has no SELECT grant on enquiries at all, not even
  // for the row just inserted. Chaining one makes the whole call fail.
  const { error } = await supabase.from('enquiries').insert({
    name: name.trim(),
    phone,
    email,
    message: message.trim(),
    // status and assigned_to are deliberately omitted, not just left at
    // client-side defaults - the insert policy requires status='new' and
    // assigned_to IS NULL, and those are the firm's triage fields, not the
    // submitter's to set.
  })

  if (error) {
    return { error: 'generic' }
  }

  return {}
}
