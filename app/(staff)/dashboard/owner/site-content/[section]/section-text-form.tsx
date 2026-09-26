'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { updateSectionText } from '../actions'
import { resolveSiteContentError } from '../error-codes'
import { BilingualField } from '../bilingual-field'
import { FieldError, FieldSuccess } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'
import type { SectionTextSlug } from '../section-config'

type SectionTextRow = {
  title_en: string | null
  title_ar: string | null
  intro_en: string | null
  intro_ar: string | null
}

// Shared by practice-areas, lawyers, and contact - the three site_sections
// rows that only ever show a title+intro pair on the public page (unlike
// hero, which has its own form for its extra eyebrow/body fields and a
// title with different fallback behaviour).
export function SectionTextForm({ slug, section }: { slug: SectionTextSlug; section: SectionTextRow | null }) {
  const t = useTranslations('dashboard.admin.siteContent')
  const tErrors = useTranslations('dashboard.admin.siteContent.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await updateSectionText(slug, formData)
      if (result.error) {
        setError(resolveSiteContentError(result.error, tErrors))
        return
      }
      setSaved(true)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <BilingualField
        nameEn="title_en"
        nameAr="title_ar"
        labelEn={t('sectionTitleEnLabel')}
        labelAr={t('sectionTitleArLabel')}
        defaultValueEn={section?.title_en ?? ''}
        defaultValueAr={section?.title_ar ?? ''}
        warningLabel={t('statusMissingEnglish')}
        warningNote={t('missingEnglishNote')}
      />

      <BilingualField
        nameEn="intro_en"
        nameAr="intro_ar"
        labelEn={t('sectionIntroEnLabel')}
        labelAr={t('sectionIntroArLabel')}
        defaultValueEn={section?.intro_en ?? ''}
        defaultValueAr={section?.intro_ar ?? ''}
        multiline
        warningLabel={t('statusMissingEnglish')}
        warningNote={t('missingEnglishNote')}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={isPending} className="self-start" data-testid="site-content-save">
          {isPending ? t('saving') : t('save')}
        </Button>
        {saved && <FieldSuccess data-testid="site-content-saved">{t('saved')}</FieldSuccess>}
      </div>
      {error && (
        <FieldError data-testid="site-content-error">
          <bdi>{error}</bdi>
        </FieldError>
      )}
    </form>
  )
}
