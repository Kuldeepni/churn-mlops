import { useState } from 'react'
export function useTheme() {
  const [theme, setTheme] = useState<'dark'|'light'>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
  }
  return { theme, toggle }
}