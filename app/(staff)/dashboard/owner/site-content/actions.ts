'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { SECTION_TEXT_KEY, type SectionTextSlug } from './section-config'
import type { SiteContentErrorCode } from './error-codes'

type ActionResult = { error?: SiteContentErrorCode }

const LANDING_PATH = '/dashboard/owner/site-content'

function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

// The public homepage is ISR (revalidate = 60) precisely so a visitor never
// pays a per-request DB round trip - but that means a save here would
// otherwise sit invisible for up to a minute, and an owner testing an edit
// would reasonably conclude the editor is broken. Revalidating both locale
// routes on every successful save makes the change appear on next request;
// the 60s interval stays as a backstop for any path that isn't reached
// through this editor.
function revalidatePublicSite() {
  revalidatePath('/en')
  revalidatePath('/ar')
}

export async function updateFirmSettings(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Empty-string values are intentional, not omissions - a trigger on this
  // table converts '' to NULL on write, the same convention already used by
  // deadline_period_types' name_ar/description_ar. Nothing here reimplements
  // that.
  const { error } = await supabase
    .from('firm_settings')
    .update({
      address_en: readString(formData, 'address_en'),
      address_ar: readString(formData, 'address_ar'),
      phone: readString(formData, 'phone'),
      email: readString(formData, 'email'),
      hours_en: readString(formData, 'hours_en'),
      hours_ar: readString(formData, 'hours_ar'),
    })
    .eq('singleton', true)

  if (error) return { error: 'save_failed' }

  revalidatePath(LANDING_PATH)
  revalidatePath(`${LANDING_PATH}/firm-details`)
  revalidatePublicSite()
  return {}
}

export async function updateHero(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('site_sections')
    .update({
      eyebrow_en: readString(formData, 'eyebrow_en'),
      eyebrow_ar: readString(formData, 'eyebrow_ar'),
      title_en: readString(formData, 'title_en'),
      title_ar: readString(formData, 'title_ar'),
      intro_en: readString(formData, 'intro_en'),
      intro_ar: readString(formData, 'intro_ar'),
      body_en: readString(formData, 'body_en'),
      body_ar: readString(formData, 'body_ar'),
    })
    .eq('key', 'hero')

  if (error) return { error: 'save_failed' }

  revalidatePath(LANDING_PATH)
  revalidatePath(`${LANDING_PATH}/hero`)
  revalidatePublicSite()
  return {}
}

// practice-areas/lawyers/contact only ever show title+intro on the public
// page (no section currently renders their eyebrow/body columns) - the
// update payload lists only those two pairs so a save here can't blank out
// columns this form never displayed.
export async function updateSectionText(slug: SectionTextSlug, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const key = SECTION_TEXT_KEY[slug]

  const { error } = await supabase
    .from('site_sections')
    .update({
      title_en: readString(formData, 'title_en'),
      title_ar: readString(formData, 'title_ar'),
      intro_en: readString(formData, 'intro_en'),
      intro_ar: readString(formData, 'intro_ar'),
    })
    .eq('key', key)

  if (error) return { error: 'save_failed' }

  revalidatePath(LANDING_PATH)
  revalidatePath(`${LANDING_PATH}/${slug}`)
  revalidatePublicSite()
  return {}
}
