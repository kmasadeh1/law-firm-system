import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { ChecklistsAdmin } from './checklists-admin'

// Document checklist templates, one list per case type. Reference data:
// guarded by the /dashboard/reference layout (can_manage_reference_data),
// the same function the items' write policies use.
export default async function ChecklistsPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.checklists' })

  const [{ data: caseTypes }, { data: items }] = await Promise.all([
    // Every case type, active or not: a deactivated type can still have
    // open cases whose checklist comes from this list.
    supabase
      .from('case_types')
      .select('id, name_en, name_ar, is_active')
      .order('sort_order', { nullsFirst: false })
      .order('name_en'),
    supabase
      .from('document_checklist_items')
      .select('id, case_type_id, name_en, name_ar, is_required, sort_order, is_active')
      .order('sort_order')
      .order('created_at'),
  ])

  // Display grouping only: items already arrive in order, so each case
  // type's list keeps the query's order.
  const groups = (caseTypes ?? []).map((caseType) => ({
    caseType,
    items: (items ?? []).filter((item) => item.case_type_id === caseType.id),
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <ChecklistsAdmin groups={groups} />
    </div>
  )
}
