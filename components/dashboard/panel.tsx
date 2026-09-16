export function Panel({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-line bg-surface p-5 ${className ?? ''}`} {...rest}>
      {children}
    </div>
  )
}
