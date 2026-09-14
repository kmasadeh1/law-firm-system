import type { Metadata } from 'next'
import { Amiri, Source_Serif_4 } from 'next/font/google'
import '../globals.css'

const amiri = Amiri({
  variable: '--font-amiri',
  subsets: ['latin', 'arabic'],
  weight: ['400', '700'],
})

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Firm Name LLP - Staff sign in',
  description: 'Staff sign in',
}

// This is a Next.js root layout in its own right - the staff area
// (/login, /dashboard/*) is not localized, so it renders <html lang="en">
// directly rather than nesting under app/[locale]. See app/[locale]/layout.tsx
// for the public site's root layout.
export default function StaffRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${amiri.variable} ${sourceSerif.variable} h-full`}>
      <body className="min-h-full flex flex-col font-body-en antialiased">{children}</body>
    </html>
  )
}
