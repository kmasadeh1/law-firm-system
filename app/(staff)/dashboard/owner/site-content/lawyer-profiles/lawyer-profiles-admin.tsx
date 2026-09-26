'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  addLawyerProfile,
  deleteLawyerProfile,
  moveLawyerProfile,
  setLawyerProfilePublished,
  updateLawyerProfile,
  type LawyerProfileRow,
} from '../actions'
import { resolveSiteContentError } from '../error-codes'
import { BilingualField } from '../bilingual-field'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Switch } from '@/components/dashboard/switch'
import { Button } from '@/components/dashboard/button'
import { EmptyState } from '@/components/dashboard/empty-state'
import { FieldError, FieldSuccess } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { ArrowUpIcon, ArrowDownIcon } from '@/components/dashboard/icons'

export function LawyerProfilesAdmin({ items: initialItems }: { items: LawyerProfileRow[] }) {
  const t = useTranslations('dashboard.admin.siteContent')
  const tErrors = useTranslations('dashboard.admin.siteContent.errors')
  const [items, setItems] = useState(initialItems)
  const [listError, setListError] = useState<string | null>(null)

  function handleMove(id: string, direction: 'up' | 'down') {
    const index = items.findIndex((item) => item.id === id)
    const neighborIndex = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || neighborIndex < 0 || neighborIndex >= items.length) return

    setListError(null)
    setItems((prev) => swap(prev, index, neighborIndex))

    moveLawyerProfile(id, direction).then((result) => {
      if (result.error) {
        setListError(resolveSiteContentError(result.error, tErrors))
        setItems((prev) => swap(prev, neighborIndex, index))
      }
    })
  }

  function handleTogglePublished(id: string, next: boolean) {
    setListError(null)
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_published: next } : item)))
    setLawyerProfilePublished(id, next).then((result) => {
      if (result.error) {
        setListError(resolveSiteContentError(result.error, tErrors))
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_published: !next } : item)))
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <AddLawyerProfileForm
        onAdded={(item) => {
          setListError(null)
          setItems((prev) => [...prev, item])
        }}
      />

      {listError && (
        <FieldError data-testid="site-content-list-error">
          <bdi>{listError}</bdi>
        </FieldError>
      )}

      {items.length === 0 ? (
        <EmptyState title={t('items.noneYet')} description={t('items.noneYetDescription')} />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item, index) => (
            <LawyerProfilePanel
              key={item.id}
              item={item}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onMove={handleMove}
              onTogglePublished={handleTogglePublished}
              onDeleted={(id) => setItems((prev) => prev.filter((row) => row.id !== id))}
              onUpdated={(id, fields) =>
                setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...fields } : row)))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function swap<T>(list: T[], i: number, j: number): T[] {
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function AddLawyerProfileForm({ onAdded }: { onAdded: (item: LawyerProfileRow) => void }) {
  const t = useTranslations('dashboard.admin.siteContent')
  const tErrors = useTranslations('dashboard.admin.siteContent.errors')
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await addLawyerProfile(formData)
      if (result.error) {
        setError(resolveSiteContentError(result.error, tErrors))
        return
      }
      if (result.item) {
        onAdded(result.item)
        setFormKey((k) => k + 1)
      }
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">{t('items.addLawyerProfile')}</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <BilingualField
          key={`name-${formKey}`}
          nameEn="name_en"
          nameAr="name_ar"
          idSuffix="new"
          labelEn={t('items.nameEnLabel')}
          labelAr={t('items.nameArLabel')}
          defaultValueEn=""
          defaultValueAr=""
          warningLabel={t('statusMissingEnglish')}
          warningNote={t('missingEnglishNote')}
        />
        <BilingualField
          key={`role-${formKey}`}
          nameEn="role_en"
          nameAr="role_ar"
          idSuffix="new"
          labelEn={t('items.roleEnLabel')}
          labelAr={t('items.roleArLabel')}
          defaultValueEn=""
          defaultValueAr=""
          warningLabel={t('statusMissingEnglish')}
          warningNote={t('missingEnglishNote')}
        />
        <BilingualField
          key={`bio-${formKey}`}
          nameEn="bio_en"
          nameAr="bio_ar"
          idSuffix="new"
          labelEn={t('items.bioEnLabel')}
          labelAr={t('items.bioArLabel')}
          defaultValueEn=""
          defaultValueAr=""
          multiline
          warningLabel={t('statusMissingEnglish')}
          warningNote={t('missingEnglishNote')}
        />
        <div>
          <Button type="submit" variant="primary" disabled={isPending} data-testid="site-content-add">
            {isPending ? t('items.adding') : t('items.add')}
          </Button>
        </div>
        {error && (
          <FieldError data-testid="site-content-add-error">
            <bdi>{error}</bdi>
          </FieldError>
        )}
      </form>
    </Panel>
  )
}

function LawyerProfilePanel({
  item,
  isFirst,
  isLast,
  onMove,
  onTogglePublished,
  onDeleted,
  onUpdated,
}: {
  item: LawyerProfileRow
  isFirst: boolean
  isLast: boolean
  onMove: (id: string, direction: 'up' | 'down') => void
  onTogglePublished: (id: string, next: boolean) => void
  onDeleted: (id: string) => void
  onUpdated: (id: string, fields: Partial<LawyerProfileRow>) => void
}) {
  const t = useTranslations('dashboard.admin.siteContent')
  const tErrors = useTranslations('dashboard.admin.siteContent.errors')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isSaving, startSave] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaveError(null)
    setSaved(false)
    const formData = new FormData(e.currentTarget)
    startSave(async () => {
      const result = await updateLawyerProfile(item.id, formData)
      if (result.error) {
        setSaveError(resolveSiteContentError(result.error, tErrors))
        return
      }
      onUpdated(item.id, {
        name_en: formData.get('name_en') as string,
        name_ar: formData.get('name_ar') as string,
        role_en: formData.get('role_en') as string,
        role_ar: formData.get('role_ar') as string,
        bio_en: formData.get('bio_en') as string,
        bio_ar: formData.get('bio_ar') as string,
      })
      setSaved(true)
    })
  }

  function handleConfirmDelete() {
    setDeleteError(null)
    startDelete(async () => {
      const result = await deleteLawyerProfile(item.id)
      setConfirmingDelete(false)
      if (result.error) {
        setDeleteError(resolveSiteContentError(result.error, tErrors))
        return
      }
      onDeleted(item.id)
    })
  }

  const displayName = item.name_en || item.name_ar || ''

  return (
    <Panel
      className={`flex flex-col gap-4 ${item.is_published ? '' : 'opacity-60'}`}
      data-testid={`lawyer-profile-${item.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onMove(item.id, 'up')}
            disabled={isFirst}
            aria-label={t('items.moveUp')}
            data-testid={`lawyer-profile-${item.id}-move-up`}
          >
            <ArrowUpIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onMove(item.id, 'down')}
            disabled={isLast}
            aria-label={t('items.moveDown')}
            data-testid={`lawyer-profile-${item.id}-move-down`}
          >
            <ArrowDownIcon className="h-4 w-4" />
          </Button>
          {!item.is_published && (
            <Badge variant="muted" data-testid={`lawyer-profile-${item.id}-hidden-badge`}>
              {t('items.hiddenBadge')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={item.is_published}
            onChange={(next) => onTogglePublished(item.id, next)}
            label={t('items.publishedSwitchLabel', { name: displayName })}
            data-testid={`lawyer-profile-${item.id}-publish-toggle`}
          />
          <span className="text-xs text-fg-muted">
            {item.is_published ? t('items.publishedLabel') : t('items.hiddenLabel')}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <BilingualField
          nameEn="name_en"
          nameAr="name_ar"
          idSuffix={item.id}
          labelEn={t('items.nameEnLabel')}
          labelAr={t('items.nameArLabel')}
          defaultValueEn={item.name_en ?? ''}
          defaultValueAr={item.name_ar ?? ''}
          warningLabel={t('statusMissingEnglish')}
          warningNote={t('missingEnglishNote')}
        />
        <BilingualField
          nameEn="role_en"
          nameAr="role_ar"
          idSuffix={item.id}
          labelEn={t('items.roleEnLabel')}
          labelAr={t('items.roleArLabel')}
          defaultValueEn={item.role_en ?? ''}
          defaultValueAr={item.role_ar ?? ''}
          warningLabel={t('statusMissingEnglish')}
          warningNote={t('missingEnglishNote')}
        />
        <BilingualField
          nameEn="bio_en"
          nameAr="bio_ar"
          idSuffix={item.id}
          labelEn={t('items.bioEnLabel')}
          labelAr={t('items.bioArLabel')}
          defaultValueEn={item.bio_en ?? ''}
          defaultValueAr={item.bio_ar ?? ''}
          multiline
          warningLabel={t('statusMissingEnglish')}
          warningNote={t('missingEnglishNote')}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={isSaving} data-testid={`lawyer-profile-${item.id}-save`}>
            {isSaving ? t('saving') : t('save')}
          </Button>
          {saved && <FieldSuccess data-testid={`lawyer-profile-${item.id}-saved`}>{t('saved')}</FieldSuccess>}
          <div className="grow" />
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirmingDelete(true)}
            disabled={isDeleting}
            data-testid={`lawyer-profile-${item.id}-delete`}
          >
            {isDeleting ? t('items.deleting') : t('items.delete')}
          </Button>
        </div>
        {saveError && (
          <FieldError data-testid={`lawyer-profile-${item.id}-save-error`}>
            <bdi>{saveError}</bdi>
          </FieldError>
        )}
        {deleteError && (
          <FieldError data-testid={`lawyer-profile-${item.id}-delete-error`}>
            <bdi>{deleteError}</bdi>
          </FieldError>
        )}
      </form>

      <DeleteConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleConfirmDelete}
        kind="hard"
        itemLabel={displayName}
        confirmLabel={t('items.delete')}
        pendingLabel={t('items.deleting')}
        pending={isDeleting}
      />
    </Panel>
  )
}
