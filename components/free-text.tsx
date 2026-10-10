import { isolateNumbers } from '@/lib/bidi'

/**
 * User-typed free text (notes, summaries, descriptions). dir="auto" takes
 * the direction from the text's own first strong character, and numbers are
 * isolated so a date inside Arabic text isn't displayed reversed. The
 * stored value is untouched; this only changes what is rendered.
 */
export function FreeText({
  children,
  as: Tag = 'span',
  className,
}: {
  children: string
  as?: 'p' | 'span' | 'dd' | 'div'
  className?: string
}) {
  return (
    <Tag dir="auto" className={className}>
      {isolateNumbers(children)}
    </Tag>
  )
}
