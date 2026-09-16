type IconProps = { className?: string }

const base = {
  viewBox: '0 0 20 20',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M5 8v8.5h10V8" />
    </svg>
  )
}

export function ClientsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 17c0-3 2.2-5 5-5s5 2 5 5" />
      <circle cx="14.5" cy="7.5" r="2" />
      <path d="M13 12.2c2.2.3 3.7 2 3.7 4.8" />
    </svg>
  )
}

export function CasesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="6.5" width="15" height="9.5" rx="1" />
      <path d="M7 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 5v1.5" />
      <path d="M2.5 10.5h15" />
    </svg>
  )
}

export function AppointmentsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="4" width="15" height="13" rx="1" />
      <path d="M2.5 8h15" />
      <path d="M6.5 2.5V5.5M13.5 2.5V5.5" />
    </svg>
  )
}

export function RolesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2.5 16 5v4.5c0 4-2.6 6.7-6 8-3.4-1.3-6-4-6-8V5Z" />
      <path d="M7.5 10 9 11.5 12.5 8" />
    </svg>
  )
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  )
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 3.5H4.5v13H8" />
      <path d="M17 10H8.5M17 10l-3-3M17 10l-3 3" />
    </svg>
  )
}
