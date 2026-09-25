'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { setSignedAgreement, getSignedAgreementUrl } from '../actions'
import { resolveFeesError } from '../error-codes'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { FieldError, controlClass } from '@/components/dashboard/form'

type AttachedDocument = { id: string; filename: string; deleted_at: string | null } | null

export type SignableDocument = { id: string; filename: string; case_id: string | null }

function AttachPicker({
  engagementId,
  candidates,
  onDone,
  onCancel,
  isReplacing,
}: {
  engagementId: string
  candidates: SignableDocument[]
  onDone: () => void
  onCancel?: () => void
  isReplacing: boolean
}) {
  const t = useTranslations('dashboard.fees.detail.agreement')
  const tErrors = useTranslations('dashboard.fees.errors')
  const [documentId, setDocumentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAttach() {
    if (!documentId) {
      setError(t('chooseDocument'))
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await setSignedAgreement(engagementId, documentId)
      if (result.error) {
        setError(resolveFeesError(result.error, tErrors))
        return
      }
      onDone()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="agreement-document" className="text-sm text-fg-muted">
            {isReplacing ? t('replaceWithLabel') : t('attachLabel')}
          </label>
          <select
            id="agreement-document"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className={controlClass}
          >
            <option value="">{t('selectDocumentPlaceholder')}</option>
            {candidates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="secondary" disabled={isPending || !documentId} onClick={handleAttach}>
          {isPending ? t('saving') : isReplacing ? t('replace') : t('attach')}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {t('cancel')}
          </Button>
        )}
      </div>
      {error && (
        <FieldError>
          <bdi>{error}</bdi>
        </FieldError>
      )}
    </div>
  )
}

function DetachButton({ engagementId, onDone }: { engagementId: string; onDone: () => void }) {
  const t = useTranslations('dashboard.fees.detail.agreement')
  const tErrors = useTranslations('dashboard.fees.errors')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await setSignedAgreement(engagementId, null)
      if (result.error) {
        setError(resolveFeesError(result.error, tErrors))
        return
      }
      onDone()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="ghost" onClick={handleClick} disabled={isPending}>
        {isPending ? t('detaching') : t('detach')}
      </Button>
      {error && (
        <FieldError>
          <bdi>{error}</bdi>
        </FieldError>
      )}
    </div>
  )
}

export function AgreementSection({
  engagementId,
  hasAttached,
  attachedDocument,
  hasLinkedCases,
  candidates,
}: {
  engagementId: string
  hasAttached: boolean
  attachedDocument: AttachedDocument
  hasLinkedCases: boolean
  candidates: SignableDocument[]
}) {
  const t = useTranslations('dashboard.fees.detail.agreement')
  const tErrors = useTranslations('dashboard.fees.errors')
  const [replacing, setReplacing] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleView() {
    if (!attachedDocument) return
    setViewError(null)
    const tab = window.open('', '_blank')
    startTransition(async () => {
      const result = await getSignedAgreementUrl(engagementId, attachedDocument.id)
      if (result.error || !result.url) {
        tab?.close()
        setViewError(result.error ? resolveFeesError(result.error, tErrors) : t('openFailed'))
        return
      }
      if (tab) tab.location.href = result.url
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        <p className="text-sm text-fg-muted">
          <bdi>{t('description')}</bdi>
        </p>
      </div>

      {hasAttached && attachedDocument && !attachedDocument.deleted_at && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
          <span className="font-medium text-fg">{attachedDocument.filename}</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={handleView} disabled={isPending}>
              {isPending ? t('opening') : t('view')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setReplacing((r) => !r)}>
              {replacing ? t('cancel') : t('replace')}
            </Button>
            <DetachButton engagementId={engagementId} onDone={() => setReplacing(false)} />
          </div>
        </div>
      )}
      {viewError && (
        <FieldError>
          <bdi>{viewError}</bdi>
        </FieldError>
      )}

      {hasAttached && attachedDocument && attachedDocument.deleted_at && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg">{attachedDocument.filename}</span>
              <Badge variant="muted">{t('removedFromCase')}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">{t('removedFromCaseDescription')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setReplacing((r) => !r)}>
              {replacing ? t('cancel') : t('replace')}
            </Button>
            <DetachButton engagementId={engagementId} onDone={() => setReplacing(false)} />
          </div>
        </div>
      )}

      {hasAttached && !attachedDocument && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
          <p className="text-fg-muted">{t('noPermissionView')}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setReplacing((r) => !r)}>
              {replacing ? t('cancel') : t('replace')}
            </Button>
            <DetachButton engagementId={engagementId} onDone={() => setReplacing(false)} />
          </div>
        </div>
      )}

      {!hasAttached && !hasLinkedCases && (
        <p className="text-sm text-fg-muted">
          <bdi>{t('noLinkedCases')}</bdi>
        </p>
      )}

      {!hasAttached && hasLinkedCases && candidates.length === 0 && (
        <p className="text-sm text-fg-muted">{t('noDocumentsOnLinkedCases')}</p>
      )}

      {!hasAttached && hasLinkedCases && candidates.length > 0 && (
        <AttachPicker engagementId={engagementId} candidates={candidates} onDone={() => {}} isReplacing={false} />
      )}

      {hasAttached && replacing && candidates.length > 0 && (
        <AttachPicker
          engagementId={engagementId}
          candidates={candidates}
          onDone={() => setReplacing(false)}
          onCancel={() => setReplacing(false)}
          isReplacing
        />
      )}
      {hasAttached && replacing && candidates.length === 0 && (
        <p className="text-sm text-fg-muted">{t('noOtherDocuments')}</p>
      )}
    </Panel>
  )
}
