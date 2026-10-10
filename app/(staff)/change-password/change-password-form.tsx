'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { changePassword } from './actions'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy'

export function ChangePasswordForm({ homeHref, forced }: { homeHref: string; forced: boolean }) {
  const router = useRouter()
  const t = useTranslations('staffAuth.changePassword')
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setExpired(false)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await changePassword(formData)
      if (result.error) {
        setError(result.error)
        setExpired(Boolean(result.expired))
        return
      }
      router.push(homeHref)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
      {error && (
        <p className="rounded-sm border border-danger bg-danger/20 px-3 py-2 text-sm text-paper">
          {error}
          {expired && ` ${t('expiredSuffix')}`}
        </p>
      )}

      {!forced && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current_password" className="text-sm text-paper-dim">
            {t('currentPasswordLabel')}
          </label>
          <input
            id="current_password"
            name="current_password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-paper-dim">
          {t('newPasswordLabel')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm text-paper-dim">
          {t('confirmPasswordLabel')}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
        />
      </div>

      <div className="mt-2 flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-sm bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brass-hover disabled:opacity-60"
        >
          {isPending ? (forced ? t('submitting') : t('voluntarySubmitting')) : forced ? t('submit') : t('voluntarySubmit')}
        </button>
        {!forced && (
          <Link href="/dashboard/settings" className="text-sm text-paper-dim underline-offset-4 hover:text-paper hover:underline">
            {t('cancel')}
          </Link>
        )}
      </div>
    </form>
  )
}
