'use client'

import { useEffect, useRef } from 'react'

/**
 * Animated dot-grid background — inspired by Wibify.agency's canvas technique.
 * Renders a breathing dot grid on a <canvas> that adjusts to the container size.
 * Used behind the Hero section on the Aletheia landing page.
 *
 * Palette: forest-green dark theme
 *   dot color: rgba(142, 182, 155, 0.55)   — sage green
 *   wave crest: rgba(218, 241, 222, 0.9)   — cream highlight
 */

const GRID_SIZE = 52        // px between dots
const DOT_RADIUS = 1.3      // base dot radius
const BASE_ALPHA = 0.18     // minimum dot opacity
const WAVE_AMP = 0.55       // wave amplitude (added on top of BASE_ALPHA)
const WAVE_SPEED = 0.0006   // animation speed
const WAVE_X = 0.018        // x-axis wave frequency
const WAVE_Y = 0.013        // y-axis wave frequency

export default function GridBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef<number>(0)
    const startRef = useRef<number>(Date.now())

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let width = 0
        let height = 0

        const resize = () => {
            const dpr = window.devicePixelRatio || 1
            const rect = canvas.parentElement!.getBoundingClientRect()
            width = rect.width
            height = rect.height
            canvas.width = width * dpr
            canvas.height = height * dpr
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`
            ctx.scale(dpr, dpr)
        }

        const ro = new ResizeObserver(resize)
        ro.observe(canvas.parentElement!)
        resize()

        const draw = () => {
            if (!ctx) return
            ctx.clearRect(0, 0, width, height)

            const t = (Date.now() - startRef.current) * WAVE_SPEED

            const cols = Math.ceil(width / GRID_SIZE) + 1
            const rows = Math.ceil(height / GRID_SIZE) + 1

            for (let col = 0; col < cols; col++) {
                for (let row = 0; row < rows; row++) {
                    const x = col * GRID_SIZE
                    const y = row * GRID_SIZE

                    // Diagonal sine wave modifies each dot's alpha individually
                    const wave = Math.sin(col * WAVE_X * GRID_SIZE + row * WAVE_Y * GRID_SIZE + t)
                    const alpha = BASE_ALPHA + WAVE_AMP * ((wave + 1) / 2)

                    // Interpolate color: sage green → cream based on wave intensity
                    // At wave=1 (crest): cream (218, 241, 222), At wave=-1 (trough): sage (142, 182, 155)
                    const waveNorm = (wave + 1) / 2  // 0-1
                    const r = Math.round(142 + waveNorm * (218 - 142))
                    const g = Math.round(182 + waveNorm * (241 - 182))
                    const b = Math.round(155 + waveNorm * (222 - 155))

                    ctx.beginPath()
                    ctx.arc(x, y, DOT_RADIUS + waveNorm * 0.5, 0, Math.PI * 2)
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
                    ctx.fill()
                }
            }

            rafRef.current = requestAnimationFrame(draw)
        }

        draw()

        return () => {
            ro.disconnect()
            cancelAnimationFrame(rafRef.current)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'block',
            }}
        />
    )
}
