'use client'

import { useState } from 'react'
import { Field, Label, controlClass } from '@/components/dashboard/form'
import { Badge } from '@/components/dashboard/badge'

// One translated pair, Arabic and English side by side - never a language
// tab. Controlled (rather than the form's usual uncontrolled/defaultValue
// pattern) because the missing-English warning has to react live as the
// owner types, not just reflect what was saved last.
export function BilingualField({
  nameEn,
  nameAr,
  labelEn,
  labelAr,
  defaultValueEn,
  defaultValueAr,
  multiline = false,
  warningLabel,
  warningNote,
  help,
}: {
  nameEn: string
  nameAr: string
  labelEn: string
  labelAr: string
  defaultValueEn: string
  defaultValueAr: string
  multiline?: boolean
  warningLabel: string
  warningNote: string
  help?: React.ReactNode
}) {
  const [en, setEn] = useState(defaultValueEn)
  const [ar, setAr] = useState(defaultValueAr)
  // Empty Arabic gracefully falls back to English on the Arabic page
  // (localizedField), so that direction needs no warning. There is no
  // fallback the other way - Arabic filled with English left blank renders
  // as an empty field for English visitors - so that's the one case this
  // flags, live, without blocking the save.
  const showWarning = ar.trim().length > 0 && en.trim().length === 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={nameAr}>{labelAr}</Label>
          {multiline ? (
            <textarea
              id={nameAr}
              name={nameAr}
              dir="rtl"
              rows={3}
              value={ar}
              onChange={(e) => setAr(e.target.value)}
              data-testid={nameAr}
              className={controlClass}
            />
          ) : (
            <input
              id={nameAr}
              name={nameAr}
              dir="rtl"
              value={ar}
              onChange={(e) => setAr(e.target.value)}
              data-testid={nameAr}
              className={controlClass}
            />
          )}
        </Field>
        <Field>
          <Label htmlFor={nameEn}>{labelEn}</Label>
          {multiline ? (
            <textarea
              id={nameEn}
              name={nameEn}
              dir="ltr"
              rows={3}
              value={en}
              onChange={(e) => setEn(e.target.value)}
              data-testid={nameEn}
              className={controlClass}
            />
          ) : (
            <input
              id={nameEn}
              name={nameEn}
              dir="ltr"
              value={en}
              onChange={(e) => setEn(e.target.value)}
              data-testid={nameEn}
              className={controlClass}
            />
          )}
        </Field>
      </div>
      {help}
      {showWarning && (
        <p className="flex items-center gap-1.5 text-xs text-fg-muted" data-testid={`${nameEn}-missing-english-warning`}>
          <Badge variant="accent">{warningLabel}</Badge>
          <bdi>{warningNote}</bdi>
        </p>
      )}
    </div>
  )
}
