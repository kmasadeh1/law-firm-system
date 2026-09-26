'use client'

// A toggle switch, not a checkbox styled to look like one - role="switch"
// with aria-checked, so it reads correctly to assistive tech as an on/off
// control rather than a form field to submit.
export function Switch({
  checked,
  disabled = false,
  onChange,
  label,
  'data-testid': dataTestId,
}: {
  checked: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  'data-testid'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      data-testid={dataTestId}
      className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'border-accent-border bg-accent' : 'border-control-border bg-surface'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
          checked ? 'translate-x-4 rtl:-translate-x-4 bg-accent-fg' : 'translate-x-0.5 rtl:-translate-x-0.5 bg-fg-muted'
        }`}
      />
    </button>
  )
}
