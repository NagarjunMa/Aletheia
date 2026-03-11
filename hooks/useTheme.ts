'use client'

import { useEffect, useState, useCallback } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme() {
    const [theme, setTheme] = useState<Theme>('dark')

    // Initialise from localStorage on mount (avoid SSR mismatch)
    useEffect(() => {
        const stored = localStorage.getItem('aletheia-theme') as Theme | null
        const initial: Theme = stored ?? 'dark'
        setTheme(initial)
        document.documentElement.setAttribute('data-theme', initial)
    }, [])

    const toggle = useCallback(() => {
        setTheme(prev => {
            const next: Theme = prev === 'dark' ? 'light' : 'dark'
            document.documentElement.setAttribute('data-theme', next)
            localStorage.setItem('aletheia-theme', next)
            return next
        })
    }, [])

    return { theme, toggle, isDark: theme === 'dark' }
}
