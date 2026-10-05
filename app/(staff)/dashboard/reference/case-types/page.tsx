import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { CaseTypesAdmin } from './case-types-admin'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function CaseTypesPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.caseTypes' })

  // Admin screen shows every case type, active or not - a deactivated type
  // must stay visible here to be reactivated, unlike the case form's
  // picker, which only offers active ones.
  const { data: caseTypes } = await supabase
    .from('case_types')
    .select('id, name_en, name_ar, is_active')
    .order('sort_order', { nullsFirst: false })
    .order('name_en')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />
      <CaseTypesAdmin caseTypes={caseTypes ?? []} />
    </div>
  )
}
