type CrestProps = {
  className?: string
}

/**
 * Placeholder mark: simple scales of justice, line art only. Stands in for
 * a real firm crest/logo until one exists.
 */
export function Crest({ className }: CrestProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="32" y1="8" x2="32" y2="50" />
      <line x1="14" y1="16" x2="50" y2="16" />
      <path d="M32 8 L38 16" />
      <path d="M32 8 L26 16" />
      <path d="M14 16 L6 30 L22 30 Z" />
      <path d="M50 16 L42 30 L58 30 Z" />
      <path d="M6 30 a8 6 0 0 0 16 0" />
      <path d="M42 30 a8 6 0 0 0 16 0" />
      <line x1="22" y1="56" x2="42" y2="56" />
      <line x1="32" y1="50" x2="32" y2="56" />
    </svg>
  )
}
