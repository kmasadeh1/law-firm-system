import { getTranslations } from 'next-intl/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { Panel } from '@/components/dashboard/panel'
import { poaStatusOf, poaStatusClass } from '@/lib/poa-status'

export type CoveringPoa = {
  poa_number: string | null
  issued_at: string | null
  expires_at: string | null
  is_revoked: boolean
  is_general: boolean
}

// Read-only - editing a وكالة lives entirely on the client page. The choice
// of which row to show (case-specific over the client's general one, over
// nothing) is made once in page.tsx via lib/poa-status.ts's
// mostRelevantPoa, over rows RLS already scoped; this component only
// renders whatever it's handed.
export async function PowerOfAttorneyLine({ poa }: { poa: CoveringPoa | null }) {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.detail.powerOfAttorney' })
  const tStatus = await getTranslations({ locale, namespace: 'dashboard.clients.detail.powerOfAttorney.status' })

  if (!poa) {
    return (
      <Panel className="flex flex-col gap-1" data-testid="case-power-of-attorney-line">
        <h2 className="font-heading text-lg text-fg">{t('caseLine.heading')}</h2>
        <p className="text-sm text-fg-muted">{t('caseLine.none')}</p>
      </Panel>
    )
  }

  const status = poaStatusOf(poa)
  const messageKey = poa.is_general
    ? poa.poa_number
      ? 'caseLine.general'
      : 'caseLine.generalNoNumber'
    : poa.poa_number
      ? 'caseLine.specific'
      : 'caseLine.specificNoNumber'

  return (
    <Panel className="flex flex-col gap-1" data-testid="case-power-of-attorney-line">
      <h2 className="font-heading text-lg text-fg">{t('caseLine.heading')}</h2>
      <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
        <span>
          {poa.poa_number
            ? t.rich(messageKey, { number: poa.poa_number, bdi: (chunks) => <span dir="ltr">{chunks}</span> })
            : t(messageKey)}
        </span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${poaStatusClass[status]}`}>
          {tStatus(status)}
        </span>
      </p>
    </Panel>
  )
}
