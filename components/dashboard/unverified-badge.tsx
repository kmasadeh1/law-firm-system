// Marks a statutory deadline period nobody has checked against the
// procedure laws yet (deadline_period_types.is_verified = false). Warning
// colours, not the neutral badge: a deadline computed from an unchecked
// period is a risk the reader should notice. The label comes from the
// caller so this works in server and client components alike.
export function UnverifiedBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-accent-border bg-accent-border/15 px-2 py-0.5 text-xs font-medium text-fg"
      data-testid="period-unverified-badge"
    >
      {label}
    </span>
  )
}
