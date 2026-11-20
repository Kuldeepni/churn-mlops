import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const t = localStorage.getItem('theme')
const dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.toggle('dark', dark)

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)