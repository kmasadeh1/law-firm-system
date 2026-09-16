import Link from 'next/link'

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-1 inline-block text-sm text-fg-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
    >
      ← {label}
    </Link>
  )
}
