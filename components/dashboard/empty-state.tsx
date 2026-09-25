export function EmptyState({
  title,
  description,
  action,
}: {
  // ReactNode, not string - a held-English title/description needs its
  // caller to wrap it in <bdi> (see e.g. dashboard/fees/page.tsx), which a
  // string-only prop can't carry.
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line px-6 py-10">
      <div>
        <p className="font-medium text-fg">{title}</p>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
