'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { updateHero } from '../actions'
import { resolveSiteContentError } from '../error-codes'
import { BilingualField } from '../bilingual-field'
import { HelpText, FieldError, FieldSuccess } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

type HeroSection = {
  eyebrow_en: string | null
  eyebrow_ar: string | null
  title_en: string | null
  title_ar: string | null
  intro_en: string | null
  intro_ar: string | null
  body_en: string | null
  body_ar: string | null
}

export function HeroForm({ section }: { section: HeroSection | null }) {
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
      const result = await updateHero(formData)
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
        nameEn="eyebrow_en"
        nameAr="eyebrow_ar"
        labelEn={t('hero.eyebrowEnLabel')}
        labelAr={t('hero.eyebrowArLabel')}
        defaultValueEn={section?.eyebrow_en ?? ''}
        defaultValueAr={section?.eyebrow_ar ?? ''}
        warningLabel={t('statusMissingEnglish')}
        warningNote={t('missingEnglishNote')}
      />

      {/* This field falls back differently from every other one on this
          page: left blank in both languages, the public page uses the
          firm's name (set under Settings) instead - not an empty headline.
          Left blank in English only, the same fallback applies for English
          visitors, so the usual "renders blank" warning would be wrong
          here; missingEnglishNoteTitle says what actually happens. */}
      <BilingualField
        nameEn="title_en"
        nameAr="title_ar"
        labelEn={t('hero.titleEnLabel')}
        labelAr={t('hero.titleArLabel')}
        defaultValueEn={section?.title_en ?? ''}
        defaultValueAr={section?.title_ar ?? ''}
        warningLabel={t('statusMissingEnglish')}
        warningNote={t('missingEnglishNoteTitle')}
        help={<HelpText><bdi>{t('hero.titleHelp')}</bdi></HelpText>}
      />

      <BilingualField
        nameEn="intro_en"
        nameAr="intro_ar"
        labelEn={t('hero.introEnLabel')}
        labelAr={t('hero.introArLabel')}
        defaultValueEn={section?.intro_en ?? ''}
        defaultValueAr={section?.intro_ar ?? ''}
        multiline
        warningLabel={t('statusMissingEnglish')}
        warningNote={t('missingEnglishNote')}
      />

      <BilingualField
        nameEn="body_en"
        nameAr="body_ar"
        labelEn={t('hero.bodyEnLabel')}
        labelAr={t('hero.bodyArLabel')}
        defaultValueEn={section?.body_en ?? ''}
        defaultValueAr={section?.body_ar ?? ''}
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
