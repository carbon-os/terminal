import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { TerminalSettings, THEME_PRESETS, FONT_FAMILIES } from './types'

declare global {
  interface Window {
    ipc: {
      send(channel: string, buf: ArrayBuffer): void
      on(channel: string, cb: (buf: ArrayBuffer) => void): void
    }
  }
}

interface Props {
  settings:  TerminalSettings
  sessionId: string
}

// ── Font loader ───────────────────────────────────────────────────────────────
// xterm draws to canvas — the font must be fully loaded before it renders,
// otherwise it silently falls back to monospace.

async function ensureFontLoaded(fontFamily: string, fontSize: number): Promise<void> {
  const entry = FONT_FAMILIES.find(f => f.value === fontFamily)
  if (entry?.system) return   // system fonts are always available

  // Extract the primary name, e.g. 'JetBrains Mono' from "'JetBrains Mono', monospace"
  const name = fontFamily.split(',')[0].trim().replace(/['"]/g, '')
  try {
    await Promise.all([
      document.fonts.load(`400 ${fontSize}px "${name}"`),
      document.fonts.load(`700 ${fontSize}px "${name}"`),
    ])
  } catch {
    // Font failed to load — xterm will fall back to monospace gracefully
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TerminalView({ settings, sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef      = useRef<Terminal | null>(null)
  const fitRef       = useRef<FitAddon | null>(null)

  // ── Mount / unmount per sessionId ──────────────────────────────────────────
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

      window.ipc.on(`pty.${sessionId}`, buf => term.write(new Uint8Array(buf)))

      term.onData(data =>
        window.ipc.send(
          `pty.${sessionId}.in`,
          new TextEncoder().encode(data).buffer as ArrayBuffer,
        )
      )

      term.onResize(({ cols, rows }) =>
        window.ipc.send(
          `pty.${sessionId}.resize`,
          new TextEncoder().encode(JSON.stringify({ cols, rows })).buffer as ArrayBuffer,
        )
      )

      window.ipc.send(
        'pty.spawn',
        new TextEncoder().encode(JSON.stringify({ id: sessionId })).buffer as ArrayBuffer,
      )

      const ro = new ResizeObserver(() => fit.fit())
      ro.observe(containerRef.current!)

      // Store ro so cleanup can reach it
      ;(term as any).__ro = ro
    }

    init()

    return () => {
      cancelled = true
      const term = termRef.current
      if (term) {
        ;(term as any).__ro?.disconnect()
        term.dispose()
      }
      termRef.current = null
      fitRef.current  = null
      window.ipc.send(
        'pty.kill',
        new TextEncoder().encode(JSON.stringify({ id: sessionId })).buffer as ArrayBuffer,
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // ── Live-update settings ────────────────────────────────────────────────────
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