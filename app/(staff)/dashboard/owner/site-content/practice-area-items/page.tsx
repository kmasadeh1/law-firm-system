import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { LinkButton } from '@/components/dashboard/button'
import { PracticeAreaItemsAdmin } from './practice-area-items-admin'

export default async function PracticeAreaItemsPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.siteContent' })

  // No is_published filter here, unlike the public page's own query - the
  // owner needs to see hidden rows (dimmed, badged) to be able to unhide
  // them, not just the subset a visitor sees.
  const { data: items } = await supabase
    .from('practice_areas')
    .select('id, name_en, name_ar, description_en, description_ar, sort_order, is_published')
    .order('sort_order')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('cards.practiceAreaItems.title')} description={t('cards.practiceAreaItems.description')} />
      <PracticeAreaItemsAdmin items={items ?? []} />
      <LinkButton href="/dashboard/owner/site-content" variant="secondary" className="self-start">
        {t('back')}
      </LinkButton>
    </div>
  )
}
