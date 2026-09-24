'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createShareLink, revokeShareLink } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { formatDateTime, formatDate } from '@/lib/format-date-time'

type ShareLink = {
  id: string
  label: string | null
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  last_accessed_at: string | null
  access_count: number
}

type LinkStatus = 'active' | 'expired' | 'revoked'

// Display-only categorization from timestamps already on the row - the same
// kind of client-side comparison the deadline urgency badges use. Enforcement
// of what counts as expired/revoked happens in get_shared_case(); this only
// decides how the row looks to staff.
function linkStatus(link: ShareLink): LinkStatus {
  if (link.revoked_at) return 'revoked'
  if (link.expires_at && new Date(link.expires_at) < new Date()) return 'expired'
  return 'active'
}

const statusBadgeVariant: Record<LinkStatus, 'accent' | 'muted'> = {
  active: 'accent',
  expired: 'muted',
  revoked: 'muted',
}

// The full URL is built client-side purely for display/sharing - the token
// itself, and everything about its validity, comes from the server action.
// Client-facing tracking links default to Arabic, the site's default locale.
function buildTrackingUrl(token: string) {
  return `${window.location.origin}/ar/track/${token}`
}

function GeneratedLinkPanel({ url }: { url: string }) {
  const t = useTranslations('dashboard.cases.detail.shareLinks')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be blocked (permissions, non-HTTPS context) - the
      // URL is still selectable/readable in the field either way.
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(url)}`

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border-2 border-accent bg-accent-border/15 p-4"
    >
      <div>
        <p className="font-heading text-base text-fg">{t('onceWarningTitle')}</p>
        <p className="mt-1 text-sm text-fg-muted">{t('onceWarningBody')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className={`min-w-0 flex-1 font-mono text-xs ${controlClass}`}
        />
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? t('copied') : t('copyLink')}
        </Button>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="primary">
            {t('sendViaWhatsapp')}
          </Button>
        </a>
      </div>
    </div>
  )
}

function RevokeButton({ caseId, linkId, linkLabel }: { caseId: string; linkId: string; linkLabel: string }) {
  const t = useTranslations('dashboard.cases.detail.shareLinks')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await revokeShareLink(caseId, linkId)
      setConfirming(false)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="danger" onClick={() => setConfirming(true)} disabled={isPending}>
        {isPending ? t('revoking') : t('revoke')}
      </Button>
      {error && <FieldError>{error}</FieldError>}

      <DeleteConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={handleConfirm}
        kind="hard"
        itemLabel={linkLabel}
        confirmLabel={t('revoke')}
        pendingLabel={t('revoking')}
        pending={isPending}
        note={t('revokeNote')}
      />
    </div>
  )
}

function LinkRow({ caseId, link }: { caseId: string; link: ShareLink }) {
  const status = linkStatus(link)
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.shareLinks')
  const statusLabelKey: Record<LinkStatus, 'statusActive' | 'statusExpired' | 'statusRevoked'> = {
    active: 'statusActive',
    expired: 'statusExpired',
    revoked: 'statusRevoked',
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-fg">{link.label || t('untitledLink')}</span>
          <Badge variant={statusBadgeVariant[status]}>{t(statusLabelKey[status])}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-fg-muted">
          {t.rich('createdOn', { date: formatDate(link.created_at, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          {link.expires_at && status === 'active' && (
            <>
              {' '}
              {t.rich('expiresOn', {
                date: formatDate(link.expires_at, locale),
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </>
          )}
          {' · '}
          {link.last_accessed_at
            ? t.rich('lastOpenedOn', {
                date: formatDateTime(link.last_accessed_at, locale),
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })
            : t('neverOpened')}
          {' · '}
          {t('viewCount', { count: link.access_count })}
        </p>
      </div>
      {status === 'active' && (
        <RevokeButton caseId={caseId} linkId={link.id} linkLabel={link.label || t('untitledLink')} />
      )}
    </li>
  )
}

export function ShareLinksSection({ caseId, links }: { caseId: string; links: ShareLink[] }) {
  const t = useTranslations('dashboard.cases.detail.shareLinks')
  const [expiresDays, setExpiresDays] = useState('90')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createShareLink(caseId, Number(expiresDays), label.trim() || null)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.token) {
        setGeneratedUrl(buildTrackingUrl(result.token))
        setLabel('')
      }
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-share-links-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
      <p className="text-sm text-fg-muted">{t('intro')}</p>

      {generatedUrl && <GeneratedLinkPanel url={generatedUrl} />}

      {links.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noShareLinksYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {links.map((l) => (
            <LinkRow key={l.id} caseId={caseId} link={l} />
          ))}
        </ul>
      )}

      <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-2">
        <Field>
          <Label htmlFor="share-label">{t('labelFieldLabel')}</Label>
          <input
            id="share-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('labelPlaceholder')}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="share-expiry">{t('expiresAfterLabel')}</Label>
          <select
            id="share-expiry"
            value={expiresDays}
            onChange={(e) => setExpiresDays(e.target.value)}
            className={controlClass}
          >
            <option value="30">{t('expiry30')}</option>
            <option value="90">{t('expiry90')}</option>
            <option value="180">{t('expiry180')}</option>
            <option value="365">{t('expiry365')}</option>
          </select>
        </Field>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? t('generating') : t('generateLink')}
        </Button>
      </form>

      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
