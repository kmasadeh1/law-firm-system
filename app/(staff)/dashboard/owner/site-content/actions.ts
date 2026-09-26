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

// --- practice_areas / lawyer_profiles: the two list-shaped tables ---
//
// Both need the same four list-only operations (add, delete, reorder,
// publish/hide) beyond the plain per-row edit every other form here already
// has. The shared mechanics (computing the next sort_order, swapping two
// rows' sort_order, revalidating) are pulled into small table-parameterized
// helpers below; add/update stay separate per entity since their field
// lists genuinely differ (name+description vs name+role+bio).

type ListTable = 'practice_areas' | 'lawyer_profiles'

const LIST_ROUTE: Record<ListTable, string> = {
  practice_areas: 'practice-area-items',
  lawyer_profiles: 'lawyer-profiles',
}

function revalidateList(table: ListTable) {
  revalidatePath(LANDING_PATH)
  revalidatePath(`${LANDING_PATH}/${LIST_ROUTE[table]}`)
  revalidatePublicSite()
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: ListTable
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  return (data?.[0]?.sort_order ?? -1) + 1
}

async function moveListItem(table: ListTable, id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: rows, error: readError } = await supabase.from(table).select('id, sort_order').order('sort_order')
  if (readError || !rows) return { error: 'reorder_failed' }

  const index = rows.findIndex((row) => row.id === id)
  const neighborIndex = direction === 'up' ? index - 1 : index + 1
  // The UI disables the up/down control at either edge, so this is only
  // reachable from a stale client state, not a real move - a no-op is the
  // right response, not an error.
  if (index === -1 || neighborIndex < 0 || neighborIndex >= rows.length) return {}

  const current = rows[index]
  const neighbor = rows[neighborIndex]
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from(table).update({ sort_order: neighbor.sort_order }).eq('id', current.id),
    supabase.from(table).update({ sort_order: current.sort_order }).eq('id', neighbor.id),
  ])
  if (e1 || e2) return { error: 'reorder_failed' }

  revalidateList(table)
  return {}
}

async function setListItemPublished(table: ListTable, id: string, published: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from(table).update({ is_published: published }).eq('id', id)
  if (error) return { error: 'publish_failed' }

  revalidateList(table)
  return {}
}

async function deleteListItem(table: ListTable, id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return { error: 'delete_failed' }

  revalidateList(table)
  return {}
}

export type PracticeAreaRow = {
  id: string
  name_en: string | null
  name_ar: string | null
  description_en: string | null
  description_ar: string | null
  sort_order: number
  is_published: boolean
}

export async function addPracticeArea(formData: FormData): Promise<ActionResult & { item?: PracticeAreaRow }> {
  const supabase = await createClient()
  const sortOrder = await nextSortOrder(supabase, 'practice_areas')

  const { data, error } = await supabase
    .from('practice_areas')
    .insert({
      name_en: readString(formData, 'name_en'),
      name_ar: readString(formData, 'name_ar'),
      description_en: readString(formData, 'description_en'),
      description_ar: readString(formData, 'description_ar'),
      sort_order: sortOrder,
      is_published: true,
    })
    .select('id, name_en, name_ar, description_en, description_ar, sort_order, is_published')
    .single()

  if (error) return { error: 'add_failed' }

  revalidateList('practice_areas')
  return { item: data }
}

export async function updatePracticeArea(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('practice_areas')
    .update({
      name_en: readString(formData, 'name_en'),
      name_ar: readString(formData, 'name_ar'),
      description_en: readString(formData, 'description_en'),
      description_ar: readString(formData, 'description_ar'),
    })
    .eq('id', id)

  if (error) return { error: 'save_failed' }

  revalidateList('practice_areas')
  return {}
}

export async function deletePracticeArea(id: string): Promise<ActionResult> {
  return deleteListItem('practice_areas', id)
}

export async function movePracticeArea(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return moveListItem('practice_areas', id, direction)
}

export async function setPracticeAreaPublished(id: string, published: boolean): Promise<ActionResult> {
  return setListItemPublished('practice_areas', id, published)
}

export type LawyerProfileRow = {
  id: string
  name_en: string | null
  name_ar: string | null
  role_en: string | null
  role_ar: string | null
  bio_en: string | null
  bio_ar: string | null
  sort_order: number
  is_published: boolean
}

// photo_path is deliberately never read or written here - there's no
// Storage bucket wired up yet and no real photographs, so a field for it
// would be a control with nowhere to send its upload.
export async function addLawyerProfile(formData: FormData): Promise<ActionResult & { item?: LawyerProfileRow }> {
  const supabase = await createClient()
  const sortOrder = await nextSortOrder(supabase, 'lawyer_profiles')

  const { data, error } = await supabase
    .from('lawyer_profiles')
    .insert({
      name_en: readString(formData, 'name_en'),
      name_ar: readString(formData, 'name_ar'),
      role_en: readString(formData, 'role_en'),
      role_ar: readString(formData, 'role_ar'),
      bio_en: readString(formData, 'bio_en'),
      bio_ar: readString(formData, 'bio_ar'),
      sort_order: sortOrder,
      is_published: true,
    })
    .select('id, name_en, name_ar, role_en, role_ar, bio_en, bio_ar, sort_order, is_published')
    .single()

  if (error) return { error: 'add_failed' }

  revalidateList('lawyer_profiles')
  return { item: data }
}

export async function updateLawyerProfile(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('lawyer_profiles')
    .update({
      name_en: readString(formData, 'name_en'),
      name_ar: readString(formData, 'name_ar'),
      role_en: readString(formData, 'role_en'),
      role_ar: readString(formData, 'role_ar'),
      bio_en: readString(formData, 'bio_en'),
      bio_ar: readString(formData, 'bio_ar'),
    })
    .eq('id', id)

  if (error) return { error: 'save_failed' }

  revalidateList('lawyer_profiles')
  return {}
}

export async function deleteLawyerProfile(id: string): Promise<ActionResult> {
  return deleteListItem('lawyer_profiles', id)
}

export async function moveLawyerProfile(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return moveListItem('lawyer_profiles', id, direction)
}

export async function setLawyerProfilePublished(id: string, published: boolean): Promise<ActionResult> {
  return setListItemPublished('lawyer_profiles', id, published)
}
