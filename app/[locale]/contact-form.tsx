'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { submitEnquiry } from './actions'

const fieldClass =
  'rounded-sm border border-warm-grey/40 bg-ink px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass'

const ERROR_KEY_BY_CODE: Record<string, string> = {
  name_required: 'errorNameRequired',
  message_required: 'errorMessageRequired',
  contact_required: 'errorContactRequired',
  generic: 'errorGeneric',
}

export function ContactForm() {
  const t = useTranslations('contact')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    // Mirrors the server's checks so a real visitor gets an immediate,
    // specific answer - the database (and the action above) still enforce
    // this regardless of what happens here.
    const name = String(formData.get('name') ?? '').trim()
    const phone = String(formData.get('phone') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const message = String(formData.get('message') ?? '').trim()

    if (!name) {
      setError('name_required')
      return
    }
    if (!message) {
      setError('message_required')
      return
    }
    if (!phone && !email) {
      setError('contact_required')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await submitEnquiry(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setSubmitted(true)
    })
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="mt-8 rounded-sm border border-brass/50 bg-ink-raised/60 p-6 text-sm leading-relaxed text-paper-dim"
      >
        <p className="font-heading text-lg text-paper">{t('successTitle')}</p>
        <p className="mt-2">{t('successMessage')}</p>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-name" className="text-sm text-paper-dim">
          {t('formNameLabel')}
        </label>
        <input id="contact-name" name="name" type="text" maxLength={200} className={fieldClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-phone" className="text-sm text-paper-dim">
          {t('formPhoneLabel')}
        </label>
        <input id="contact-phone" name="phone" type="tel" maxLength={40} className={fieldClass} dir="ltr" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-email" className="text-sm text-paper-dim">
          {t('formEmailLabel')}
        </label>
        <input id="contact-email" name="email" type="email" maxLength={320} className={fieldClass} dir="ltr" />
      </div>

      <p className="text-xs text-paper-dim/80">{t('formContactHint')}</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-sm text-paper-dim">
          {t('formMessageLabel')}
        </label>
        <textarea id="contact-message" name="message" rows={3} maxLength={5000} className={fieldClass} />
      </div>

      {/* Honeypot - real visitors never see this field (off-screen, not
          display:none, and out of tab order). A filled value is treated as a
          bot server-side; nothing about that is revealed here or there. */}
      <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error && <p className="text-sm text-danger">{t(ERROR_KEY_BY_CODE[error] ?? 'errorGeneric')}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 self-start rounded-sm bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brass-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t('sending') : t('submit')}
      </button>
    </form>
  )
}
