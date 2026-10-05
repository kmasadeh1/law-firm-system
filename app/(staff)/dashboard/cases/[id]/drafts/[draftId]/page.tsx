import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { isPlaceholderEmail } from '@/lib/public-site'
import { BackLink } from '@/components/dashboard/back-link'
import { DraftEditor } from './draft-editor'

// One draft: edited in the browser as plain text and printed, the same
// pattern as the payment receipt - the browser does the Arabic shaping and
// RTL that a generated file would get wrong.
//
// No access check of its own: document_drafts' SELECT policy is
// can_write_case_documents(case_id), the same as its UPDATE policy, so a
// draft this reader can see is one they may edit. Not visible and not
// found read the same.
export default async function DraftPage({ params }: PageProps<'/dashboard/cases/[id]/drafts/[draftId]'>) {
  const { id, draftId } = await params
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.drafts' })
  // The letterhead carries both of the firm's names: a draft can be in
  // either language whatever the reader's own, and a bilingual letterhead
  // is right for both.
  const tShellEn = await getTranslations({ locale: 'en', namespace: 'dashboard.shell' })
  const tShellAr = await getTranslations({ locale: 'ar', namespace: 'dashboard.shell' })

  const [{ data: draft }, { data: firm }] = await Promise.all([
    supabase
      .from('document_drafts')
      .select('id, title, body')
      .eq('id', draftId)
      .eq('case_id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase.from('firm_settings').select('address_en, address_ar, phone, email').maybeSingle(),
  ])

  if (!draft) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href={`/dashboard/cases/${id}`} label={t('backToCase')} />
        <p className="text-sm text-fg-muted" data-testid="draft-not-found">
          {t('notFound')}
        </p>
      </div>
    )
  }

  return (
    <DraftEditor
      caseId={id}
      draft={draft}
      letterhead={{
        nameEn: tShellEn('firmName'),
        nameAr: tShellAr('firmName'),
        addressEn: firm?.address_en ?? null,
        addressAr: firm?.address_ar ?? null,
        phone: firm?.phone ?? null,
        // Never print the seeded placeholder address as the firm's email.
        email: firm?.email && !isPlaceholderEmail(firm.email) ? firm.email : null,
      }}
    />
  )
}
