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

export function FieldSuccess({
  children,
  'data-testid': dataTestId,
}: {
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <p className="text-sm text-success-text" data-testid={dataTestId}>
      {children}
    </p>
  )
}

export function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>
}
