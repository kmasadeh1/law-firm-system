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
  idSuffix,
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
  // The `name` attribute stays the plain field key (what the server action
  // reads via formData.get) - this only disambiguates `id`/data-testid when
  // more than one instance of the same field renders on one page, e.g. one
  // per row of a list (duplicate ids are invalid HTML and would break
  // <label htmlFor> association and testid lookups alike).
  idSuffix?: string
}) {
  const [en, setEn] = useState(defaultValueEn)
  const [ar, setAr] = useState(defaultValueAr)
  const idEn = idSuffix ? `${nameEn}-${idSuffix}` : nameEn
  const idAr = idSuffix ? `${nameAr}-${idSuffix}` : nameAr
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
          <Label htmlFor={idAr}>{labelAr}</Label>
          {multiline ? (
            <textarea
              id={idAr}
              name={nameAr}
              dir="rtl"
              rows={3}
              value={ar}
              onChange={(e) => setAr(e.target.value)}
              data-testid={idAr}
              className={controlClass}
            />
          ) : (
            <input
              id={idAr}
              name={nameAr}
              dir="rtl"
              value={ar}
              onChange={(e) => setAr(e.target.value)}
              data-testid={idAr}
              className={controlClass}
            />
          )}
        </Field>
        <Field>
          <Label htmlFor={idEn}>{labelEn}</Label>
          {multiline ? (
            <textarea
              id={idEn}
              name={nameEn}
              dir="ltr"
              rows={3}
              value={en}
              onChange={(e) => setEn(e.target.value)}
              data-testid={idEn}
              className={controlClass}
            />
          ) : (
            <input
              id={idEn}
              name={nameEn}
              dir="ltr"
              value={en}
              onChange={(e) => setEn(e.target.value)}
              data-testid={idEn}
              className={controlClass}
            />
          )}
        </Field>
      </div>
      {help}
      {showWarning && (
        <p className="flex items-center gap-1.5 text-xs text-fg-muted" data-testid={`${idEn}-missing-english-warning`}>
          <Badge variant="accent">{warningLabel}</Badge>
          <bdi>{warningNote}</bdi>
        </p>
      )}
    </div>
  )
}
