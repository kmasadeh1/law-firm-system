import Image from 'next/image'

type CrestProps = {
  className?: string
  variant?: 'gold' | 'white'
}

/**
 * The firm's real crest mark. This is a flat, single-colour raster
 * extracted from a marketing render - the designer's vector source hasn't
 * arrived yet. Unlike the old placeholder SVG, it can't be recoloured with
 * currentColor; pick the flat variant that actually reads against the
 * background it sits on. Don't upscale past its native ~277x271 - it's
 * fine shrunk down, not blown up.
 */
export function Crest({ className, variant = 'gold' }: CrestProps) {
  const src = variant === 'white' ? '/brand/logo_crest_flat_white.png' : '/brand/logo_crest_flat_gold.png'
  return <Image src={src} alt="" width={277} height={271} className={className} aria-hidden="true" />
}
