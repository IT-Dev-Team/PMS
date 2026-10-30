// components/theme/ThemeToggle.tsx
// Sun / moon button. `variant="header"` is styled for the dark green header bar.
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../ThemeProvider '

export function ThemeToggle({ variant = 'default', className = '' }: { variant?: 'default' | 'header'; className?: string }) {
  const { resolved, toggle, mounted } = useTheme()
  const dark = mounted && resolved === 'dark'
  const base = variant === 'header'
    ? 'text-[#EAD9C3] hover:bg-white/10 hover:text-white'
    : 'border border-eih-line text-eih-ink hover:bg-eih-cream'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`relative rounded-lg p-2 transition ${base} ${className}`}
    >
      {/* both icons are always rendered so there is no layout shift or hydration mismatch */}
      <Sun className={`h-5 w-5 transition ${dark ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
      <Moon className={`absolute inset-0 m-auto h-5 w-5 transition ${dark ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`} />
    </button>
  )
}
export default ThemeToggle