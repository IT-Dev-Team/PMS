// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EIH Chat - Ethiopian Investment Holding',
  description: 'AI-powered document analysis and chat platform for Ethiopian Investment Holding',
  keywords: 'Ethiopian Investment Holding, AI Chat, Document Analysis, Business License',
  authors: [{ name: 'EIH Team' }],
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: '/eih.png',
    shortcut: '/eih.png',
    apple: '/eih.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  )
}