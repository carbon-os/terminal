import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { TerminalSettings, THEME_PRESETS, FONT_FAMILIES, ShellType } from './types'
import { ipc } from '../ipc/client'

interface Props {
    settings:  TerminalSettings
    sessionId: string
    shell:     ShellType
    isActive:  boolean
}

// ── Font loader ───────────────────────────────────────────────────────────────

async function ensureFontLoaded(fontFamily: string, fontSize: number): Promise<void> {
    const entry = FONT_FAMILIES.find(f => f.value === fontFamily)
    if (entry?.system) return
    const name = fontFamily.split(',')[0].trim().replace(/['"]/g, '')
    try {
        await Promise.all([
            document.fonts.load(`400 ${fontSize}px "${name}"`),
            document.fonts.load(`700 ${fontSize}px "${name}"`),
        ])
    } catch { /* fall back to monospace gracefully */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TerminalView({ settings, sessionId, shell, isActive }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const termRef      = useRef<Terminal | null>(null)
    const fitRef       = useRef<FitAddon | null>(null)

    // ── Mount / unmount per sessionId ─────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current) return
        let cancelled = false

        async function init() {
            await ensureFontLoaded(settings.fontFamily, settings.fontSize)
            if (cancelled || !containerRef.current) return

            const term = new Terminal({
                theme:         THEME_PRESETS[settings.theme] as any,
                cursorBlink:   settings.cursorBlink,
                cursorStyle:   settings.cursorStyle,
                fontSize:      settings.fontSize,
                fontFamily:    settings.fontFamily,
                lineHeight:    settings.lineHeight,
                letterSpacing: settings.letterSpacing,
                scrollback:    settings.scrollback,
            })

            const fit = new FitAddon()
            term.loadAddon(fit)
            term.open(containerRef.current)
            fit.fit()

            termRef.current = term
            fitRef.current  = fit

            const unsubOut = ipc.on('pty.out', (payload, sid) => {
                if (sid !== sessionId) return
                term.write(new Uint8Array(payload))
            })

            const unsubExit = ipc.on('pty.exit', (_payload, sid) => {
                if (sid !== sessionId) return
                term.writeln('\r\n\x1b[31m[process exited]\x1b[0m')
            })

            term.onData(data =>
                ipc.sendBuf(
                    'pty.in',
                    sessionId,
                    new TextEncoder().encode(data).buffer as ArrayBuffer,
                    /*binary=*/ true,
                )
            )

            term.onResize(({ cols, rows }) =>
                ipc.sendJSON('pty.resize', sessionId, { cols, rows })
            )

            ipc.sendJSON('pty.spawn', sessionId, {
                cols:  term.cols,
                rows:  term.rows,
                shell,
            })

            // ── ResizeObserver: skip zero-dimension frames, defer to next paint
            const ro = new ResizeObserver(() => {
                const el = containerRef.current
                if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return
                requestAnimationFrame(() => fitRef.current?.fit())
            })
            ro.observe(containerRef.current!)

            ;(term as any).__ro    = ro
            ;(term as any).__unsub = () => { unsubOut(); unsubExit() }
        }

        init()

        return () => {
            cancelled = true
            const term = termRef.current
            if (term) {
                ;(term as any).__ro?.disconnect()
                ;(term as any).__unsub?.()
                term.dispose()
            }
            termRef.current = null
            fitRef.current  = null
            ipc.sendJSON('pty.kill', sessionId, {})
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId])

    // ── Re-fit when this tab becomes active ───────────────────────────────────
    useEffect(() => {
        if (!isActive) return
        const el = containerRef.current
        if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return
        requestAnimationFrame(() => fitRef.current?.fit())
    }, [isActive])

    // ── Live-update settings ──────────────────────────────────────────────────
    useEffect(() => {
        const term = termRef.current
        if (!term) return

        async function apply() {
            await ensureFontLoaded(settings.fontFamily, settings.fontSize)
            const t = termRef.current
            if (!t) return
            t.options.theme         = THEME_PRESETS[settings.theme] as any
            t.options.cursorBlink   = settings.cursorBlink
            t.options.cursorStyle   = settings.cursorStyle
            t.options.fontSize      = settings.fontSize
            t.options.fontFamily    = settings.fontFamily
            t.options.lineHeight    = settings.lineHeight
            t.options.letterSpacing = settings.letterSpacing
            t.options.scrollback    = settings.scrollback
            fitRef.current?.fit()
        }

        apply()
    }, [settings])

    return (
        <>
            <style>{`
                .xterm-viewport::-webkit-scrollbar { display: none; }
                .xterm-viewport { scrollbar-width: none; }
            `}</style>
            <div ref={containerRef} style={{ width: '100%', height: '100%', padding: 6 }} />
        </>
    )
}