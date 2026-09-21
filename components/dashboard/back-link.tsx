import Link from 'next/link'
import { ChevronLeftIcon } from './icons'

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-surface px-3.5 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-line/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <ChevronLeftIcon className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />
      {label}
    </Link>
  )
}
