import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { CourtsAdmin } from './courts-admin'
import { PageHeader } from '@/components/dashboard/page-header'
import { dashboardTitle } from '@/lib/page-title'

export default async function CourtsPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.courts' })

  // Admin screen shows every court, active or not - a deactivated court must
  // stay visible here to be reactivated, unlike the case page's picker,
  // which only offers active ones.
  const { data: courts } = await supabase
    .from('courts')
    .select('id, name_en, name_ar, city_en, city_ar, court_type, is_active')
    .order('sort_order', { nullsFirst: false })
    .order('name_en')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />
      <CourtsAdmin courts={courts ?? []} />
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('courts')
