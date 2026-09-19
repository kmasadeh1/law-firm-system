'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changePassword } from './actions'

export function ChangePasswordForm({ homeHref }: { homeHref: string }) {
  const router = useRouter()
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
          {expired && ' Ask the owner to issue you a new one.'}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-paper-dim">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm text-paper-dim">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-sm bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brass-hover disabled:opacity-60"
      >
        {isPending ? 'Setting password…' : 'Set password and continue'}
      </button>
    </form>
  )
}
