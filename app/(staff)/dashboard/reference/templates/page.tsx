import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { localizedName } from '@/lib/localized-name'
import { TemplatesAdmin } from './templates-admin'

// Document templates. Reference data: guarded by the /dashboard/reference
// layout (can_manage_reference_data), the same function the templates'
// write policies use.
export default async function TemplatesPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.templates' })

  const [{ data: templates }, { data: caseTypes }] = await Promise.all([
    // Every template, active or not - a deactivated one must stay visible
    // here to be reactivated.
    supabase
      .from('document_templates')
      .select('id, case_type_id, name_en, name_ar, body_en, body_ar, is_active')
      .order('sort_order')
      .order('created_at'),
    supabase.from('case_types').select('id, name_en, name_ar, is_active').order('sort_order').order('name_en'),
  ])

  const caseTypeOptions = (caseTypes ?? []).map((c) => ({
    id: c.id,
    name: localizedName({ name: c.name_en ?? c.name_ar ?? '', name_ar: c.name_ar }, locale),
    is_active: c.is_active,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <TemplatesAdmin templates={templates ?? []} caseTypes={caseTypeOptions} />
    </div>
  )
}
