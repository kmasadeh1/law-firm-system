import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Crest } from '@/components/crest'
import { LanguageSwitcher } from '../../components/language-switcher'
import { localizedName } from '@/lib/localized-name'

type SharedCase = {
  case_number: string
  title: string
  status: string
  status_ar?: string | null
  opened_at: string
  next_hearing: string | null
}

export default async function TrackCasePage({ params }: PageProps<'/[locale]/track/[token]'>) {
  const { locale, token } = await params
  const t = await getTranslations()
  const supabase = await createClient()

  // Public, anon-callable RPC. It returns null for anything invalid, revoked
  // or expired - on purpose, it doesn't distinguish between those, so this
  // page can't either.
  const { data } = await supabase.rpc('get_shared_case', { p_token: token })
  const sharedCase = data as SharedCase | null

  return (
    <div className="flex min-h-screen flex-col bg-ink text-paper">
      <header className="flex items-center justify-between gap-2.5 px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2.5">
          <Crest className="h-9 w-9" />
          <span className="font-heading text-lg">{t('layout.firmName')}</span>
        </div>
        <LanguageSwitcher href={`/track/${token}`} />
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-10 sm:py-16">
        {sharedCase ? (
          <div className="w-full max-w-md rounded-md border border-warm-grey/25 bg-ink-raised p-6 sm:p-8">
            <h1 className="font-heading text-2xl text-paper">{t('track.title')}</h1>
            <p className="mt-1 text-lg text-paper">{sharedCase.title}</p>

            <dl className="mt-6 flex flex-col gap-4 text-sm">
              <div>
                <dt className="text-paper-dim">{t('track.caseNumberLabel')}</dt>
                <dd className="mt-0.5 text-paper" dir="ltr">
                  {sharedCase.case_number}
                </dd>
              </div>
              <div>
                <dt className="text-paper-dim">{t('track.statusLabel')}</dt>
                <dd className="mt-0.5 text-paper">
                  {localizedName({ name: sharedCase.status, name_ar: sharedCase.status_ar }, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-paper-dim">{t('track.openedLabel')}</dt>
                <dd className="mt-0.5 text-paper">
                  {new Date(sharedCase.opened_at).toLocaleDateString(locale, { dateStyle: 'long' })}
                </dd>
              </div>
              <div>
                <dt className="text-paper-dim">{t('track.nextHearingLabel')}</dt>
                <dd className="mt-0.5 text-paper">
                  {sharedCase.next_hearing
                    ? new Date(sharedCase.next_hearing).toLocaleString(locale, {
                        dateStyle: 'long',
                        timeStyle: 'short',
                      })
                    : t('track.noNextHearing')}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="w-full max-w-md rounded-md border border-warm-grey/25 bg-ink-raised p-6 text-center sm:p-8">
            <h1 className="font-heading text-xl text-paper">{t('track.invalidTitle')}</h1>
            <p className="mt-2 text-sm text-paper-dim">{t('track.invalidMessage')}</p>
          </div>
        )}
      </main>
    </div>
  )
}
