type Kind = 'error' | 'success' | 'warning'

const styles: Record<Kind, string> = {
  error: 'border-danger-text/30 bg-danger-text/10 text-danger-text',
  success: 'border-success-text/30 bg-success-text/10 text-success-text',
  warning: 'border-accent-border/40 bg-accent-border/10 text-fg',
}

export function Banner({ kind, children }: { kind: Kind; children: React.ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${styles[kind]}`}>
      {children}
    </p>
  )
}
