// Shared visual pattern for "both languages shown, active one emphasised,
// inactive one muted, slash-joined" - used by the public site's language
// switcher (app/[locale]/components/language-switcher.tsx, navigates to a
// locale-prefixed URL) and the dashboard's locale toggle
// (components/dashboard/locale-toggle.tsx, calls the setLocale server
// action to write staff.locale). Those two have genuinely different
// behaviour and must stay that way - this component only owns the layout
// and lets each caller supply its own render per option, so it never
// decides what clicking an option does.
//
// It also takes every colour as a prop rather than assuming one. The two
// trees' "muted"/"accent" tokens are NOT interchangeable: the dashboard's
// text-accent/text-fg-muted are theme-toggle-aware (accent is ink, not
// brass, in the dashboard's light theme - brass on light fails contrast,
// see globals.css), while the public site's text-brass/text-paper-dim are
// fixed-dark aliases that ignore the toggle. Hardcoding either family here
// would silently break the other tree.
export type LanguagePairOption = {
  code: string
  label: string
  active: boolean
}

export function LanguagePair({
  options,
  activeClassName,
  inactiveClassName,
  separatorClassName,
  renderOption,
}: {
  options: LanguagePairOption[]
  activeClassName: string
  inactiveClassName: string
  separatorClassName: string
  renderOption: (option: LanguagePairOption, className: string) => React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {options.map((option, i) => (
        <span key={option.code} className="flex items-center gap-1">
          {i > 0 && (
            <span className={separatorClassName} aria-hidden="true">
              /
            </span>
          )}
          {renderOption(option, option.active ? activeClassName : inactiveClassName)}
        </span>
      ))}
    </div>
  )
}
