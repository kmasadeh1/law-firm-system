import { forwardRef } from 'react'
import Link, { type LinkProps } from 'next/link'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'border border-accent-border bg-accent px-4 py-2 text-accent-fg hover:opacity-90',
  secondary: 'border border-line bg-surface px-4 py-2 text-fg hover:bg-line/40',
  ghost: 'px-2 py-1 text-fg-muted hover:text-fg',
  danger: 'px-2 py-1 text-danger-text hover:underline',
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  'data-testid'?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className ?? ''}`}
      {...props}
    />
  )
})

type LinkButtonProps = LinkProps &
  Omit<React.ComponentProps<'a'>, keyof LinkProps> & {
    variant?: Variant
  }

export function LinkButton({ variant = 'primary', className, ...props }: LinkButtonProps) {
  return <Link className={`${base} ${variants[variant]} ${className ?? ''}`} {...props} />
}
