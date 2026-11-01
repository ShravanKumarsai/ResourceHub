import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const sans = Geist({ subsets: ['latin'], variable: '--font-sans-stack' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono-stack' })

export const metadata: Metadata = {
  title: {
    default: 'ResourceHub | Shared engineering resources across institutions',
    template: '%s | ResourceHub',
  },
  description:
    'ResourceHub lets students, researchers, and institutions find, book, and manage laboratory equipment, workshops, and computing resources across participating universities.',
}

export const viewport: Viewport = {
  themeColor: '#17324d',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} bg-white`}>
      <body className="min-h-dvh font-sans antialiased">
        <TooltipProvider>
          {children}
          <Toaster position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  )
}
