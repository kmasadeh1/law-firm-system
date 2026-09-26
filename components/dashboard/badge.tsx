type Variant = 'neutral' | 'accent' | 'muted'

const variants: Record<Variant, string> = {
  neutral: 'border border-line text-fg',
  accent: 'border border-accent-border bg-accent text-accent-fg',
  muted: 'border border-line text-fg-muted',
}

export function Badge({
  children,
  variant = 'neutral',
  'data-testid': dataTestId,
}: {
  children: React.ReactNode
  variant?: Variant
  'data-testid'?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]}`}
      data-testid={dataTestId}
    >
      {children}
    </span>
  )
}
