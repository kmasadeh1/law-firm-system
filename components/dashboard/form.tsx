export const controlClass =
  'rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-focus focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50'

export function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
      {children} {required && <span className="text-danger-text">*</span>}
    </label>
  )
}

export function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-fg-muted">{children}</p>
}

export function FieldError({
  children,
  'data-testid': dataTestId,
}: {
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <p className="text-sm text-danger-text" data-testid={dataTestId}>
      {children}
    </p>
  )
}

// Inline save confirmation. The slot is always rendered: when show is false
// the same text is laid out but invisible, so it holds its size and nothing
// around it moves when the confirmation appears. (A conditionally inserted
// message reflowed everything below it and made controls jump mid-click.)
export function FieldSuccess({
  children,
  show = true,
  'data-testid': dataTestId,
}: {
  children: React.ReactNode
  show?: boolean
  'data-testid'?: string
}) {
  return (
    <p
      className={`text-sm text-success-text${show ? '' : ' invisible'}`}
      aria-hidden={show ? undefined : true}
      data-testid={show ? dataTestId : undefined}
    >
      {children}
    </p>
  )
}

export function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>
}
