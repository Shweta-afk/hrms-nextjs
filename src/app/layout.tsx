import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

// Self-hosted via next/font — zero external round-trip, auto-subsetting, swap display
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
})

export const metadata: Metadata = {
  title: 'Axiotta HRMS',
  description: 'Axiotta Technologies HR Management System',
  icons: {
    icon: '/lightmodelogo.png',
    shortcut: '/lightmodelogo.png',
    apple: '/lightmodelogo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
