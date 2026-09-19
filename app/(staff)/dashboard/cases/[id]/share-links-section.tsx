'use client'

import { useState, useTransition } from 'react'
import { createShareLink, revokeShareLink } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'

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

const statusLabel: Record<LinkStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

// The full URL is built client-side purely for display/sharing - the token
// itself, and everything about its validity, comes from the server action.
// Client-facing tracking links default to Arabic, the site's default locale.
function buildTrackingUrl(token: string) {
  return `${window.location.origin}/ar/track/${token}`
}

function GeneratedLinkPanel({ url }: { url: string }) {
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
        <p className="font-heading text-base text-fg">
          This link will only be shown once — save it now
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          It isn&apos;t stored anywhere you can retrieve it later. If you leave this page
          without copying or sending it, it&apos;s gone — you&apos;d have to generate a new
          one, which won&apos;t restore this one.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className={`min-w-0 flex-1 font-mono text-xs ${controlClass}`}
        />
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="primary">
            Send via WhatsApp
          </Button>
        </a>
      </div>
    </div>
  )
}

function RevokeButton({ caseId, linkId }: { caseId: string; linkId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await revokeShareLink(caseId, linkId)
      if (result.error) {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="danger" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Revoking…' : confirming ? 'Confirm revoke?' : 'Revoke'}
      </Button>
      {confirming && !isPending && (
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      )}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

function LinkRow({ caseId, link }: { caseId: string; link: ShareLink }) {
  const status = linkStatus(link)

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-fg">{link.label || 'Untitled link'}</span>
          <Badge variant={statusBadgeVariant[status]}>{statusLabel[status]}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-fg-muted">
          Created {formatDate(link.created_at)}
          {link.expires_at && status === 'active' && ` · expires ${formatDate(link.expires_at)}`}
          {' · '}
          {link.last_accessed_at ? `last opened ${formatDateTime(link.last_accessed_at)}` : 'Never opened'}
          {' · '}
          {link.access_count} {link.access_count === 1 ? 'view' : 'views'}
        </p>
      </div>
      {status === 'active' && <RevokeButton caseId={caseId} linkId={link.id} />}
    </li>
  )
}

export function ShareLinksSection({ caseId, links }: { caseId: string; links: ShareLink[] }) {
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
      <h2 className="font-heading text-lg text-fg">Share with client</h2>
      <p className="text-sm text-fg-muted">
        Generate a link the client can open to track this case&apos;s status — no account
        needed. Send it over WhatsApp or however you reach them.
      </p>

      {generatedUrl && <GeneratedLinkPanel url={generatedUrl} />}

      {links.length === 0 ? (
        <p className="text-sm text-fg-muted">No share links yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {links.map((l) => (
            <LinkRow key={l.id} caseId={caseId} link={l} />
          ))}
        </ul>
      )}

      <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-2">
        <Field>
          <Label htmlFor="share-label">Label (optional)</Label>
          <input
            id="share-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Sent to client's father"
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="share-expiry">Expires after</Label>
          <select
            id="share-expiry"
            value={expiresDays}
            onChange={(e) => setExpiresDays(e.target.value)}
            className={controlClass}
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">365 days</option>
          </select>
        </Field>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? 'Generating…' : 'Generate link'}
        </Button>
      </form>

      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
