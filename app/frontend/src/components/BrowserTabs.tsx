import { useEffect, useRef, useState } from 'react'
import { BrowserTabsCore } from './tabs'
import { TerminalSession, PanelTheme, Profile, ShellType, SHELL_DEFS } from './types'
import './tabs.css'

import powershellIcon from '../assets/powershell.png'
import cmdIcon        from '../assets/cmd.png'
import wsl2Icon       from '../assets/wsl2.png'
import settingsIcon   from '../assets/settings.png'

const TAB_ICONS: Record<string, string> = {
    powershell: powershellIcon,
    cmd:        cmdIcon,
    wsl2:       wsl2Icon,
    settings:   settingsIcon,
}

interface Props {
    sessions:        TerminalSession[]
    activeSessionId: string
    onSelectSession: (id: string) => void
    onAddSession:    (shell?: ShellType, profile?: Profile) => void
    onKillSession:   (id: string) => void
    onOpenSettings:  () => void
    profiles:        Profile[]
    darkTheme?:      boolean
    ui:              PanelTheme
    termBg:          string
}

function MenuItem({
    icon, label, onClick, ui, danger = false,
}: {
    icon?:   string
    label:   string
    onClick: () => void
    ui:      PanelTheme
    danger?: boolean
}) {
    const [hovered, setHovered] = useState(false)
    return (
        <div
            role="menuitem"
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display:      'flex',
                alignItems:   'center',
                gap:          9,
                padding:      '7px 12px',
                cursor:       'pointer',
                background:   hovered ? ui.rowHover : 'transparent',
                color:        danger ? '#e05555' : ui.text,
                fontSize:     12,
                fontFamily:   'system-ui, sans-serif',
                userSelect:   'none',
                transition:   'background 0.1s',
                borderRadius: 5,
                margin:       '0 4px',
            }}
        >
            {icon && (
                <img
                    src={icon}
                    width={15}
                    height={15}
                    style={{ objectFit: 'contain', flexShrink: 0, opacity: 0.85 }}
                />
            )}
            {label}
        </div>
    )
}

function MenuSeparator({ ui }: { ui: PanelTheme }) {
    return <div style={{ height: 1, background: ui.border, margin: '5px 0' }} />
}

function MenuLabel({ label, ui }: { label: string; ui: PanelTheme }) {
    return (
        <div style={{
            padding:       '6px 12px 3px',
            fontSize:      10,
            fontWeight:    700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color:         ui.subtext,
            fontFamily:    'system-ui, sans-serif',
            userSelect:    'none',
        }}>
            {label}
        </div>
    )
}

const CONTROLS_RESERVED_PX = 64

export default function BrowserTabs({
    sessions, activeSessionId,
    onSelectSession, onAddSession, onKillSession, onOpenSettings,
    profiles, darkTheme = false, ui, termBg,
}: Props) {
    const containerRef   = useRef<HTMLDivElement>(null)
    const coreRef        = useRef<BrowserTabsCore | null>(null)
    const prevSessionIds = useRef<string[]>([])

    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // ── Close dropdown on outside click ──────────────────────────────────────
    useEffect(() => {
        if (!dropdownOpen) return
        function onDown(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
                setDropdownOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [dropdownOpen])

    // ── Mount core once ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current) return
        const core = new BrowserTabsCore()
        coreRef.current = core
        core.init(containerRef.current)

        const el = containerRef.current
        const onActive = (e: Event) => {
            const id = (e as CustomEvent).detail.tabEl.getAttribute('data-tab-id')
            if (id) onSelectSession(id)
        }
        const onRemove = (e: Event) => {
            const id = (e as CustomEvent).detail.tabEl.getAttribute('data-tab-id')
            if (id) onKillSession(id)
        }
        el.addEventListener('activeTabChange', onActive)
        el.addEventListener('tabRemove',       onRemove)

        return () => {
            el.removeEventListener('activeTabChange', onActive)
            el.removeEventListener('tabRemove',       onRemove)
            core.destroy()
            coreRef.current = null
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Sync CSS variables whenever theme changes ─────────────────────────────
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        el.style.setProperty('--tab-active-bg', termBg)
        el.style.setProperty('--tab-bar-bg',    ui.tabBarBg)
    }, [termBg, ui.tabBarBg])

    // ── Sync sessions → DOM tabs ──────────────────────────────────────────────
    useEffect(() => {
        const core = coreRef.current
        if (!core) return

        const prev = prevSessionIds.current
        const next = sessions.map(s => s.id)

        sessions.forEach(s => {
            if (!prev.includes(s.id)) {
                core.addTab(
                    {
                        title:   s.name,
                        id:      s.id,
                        favicon: TAB_ICONS[s.kind === 'settings' ? 'settings' : s.shell],
                    },
                    { background: true },
                )
            }
        })

        prev.forEach(id => {
            if (!next.includes(id)) core.removeTabById(id)
        })

        prevSessionIds.current = next
    }, [sessions])

    // ── Sync active tab ───────────────────────────────────────────────────────
    useEffect(() => {
        coreRef.current?.setCurrentTabById(activeSessionId)
    }, [activeSessionId])

    // ── Dark theme class ──────────────────────────────────────────────────────
    useEffect(() => {
        containerRef.current?.classList.toggle('browser-tabs-dark-theme', darkTheme)
    }, [darkTheme])

    function close() { setDropdownOpen(false) }

    return (
        <div style={{ position: 'relative' }}>

            <div
                ref={containerRef}
                className={`browser-tabs${darkTheme ? ' browser-tabs-dark-theme' : ''}`}
                style={{
                    paddingRight: CONTROLS_RESERVED_PX,
                    '--tab-content-margin': '9px',
                } as React.CSSProperties}
            >
                <div className="browser-tabs-content" />
                <div className="browser-tabs-bottom-bar" />
            </div>

            {/* ── Right-side controls — outside overflow:hidden ── */}
            <div style={{
                position:   'absolute',
                right:      6,
                top:        '50%',
                transform:  'translateY(-50%) translateY(-2px)',
                display:    'flex',
                alignItems: 'center',
                gap:        1,
                zIndex:     20,
            }}>

                <button
                    onClick={() => onAddSession('powershell')}
                    title="New PowerShell tab"
                    style={ctrlBtnStyle(ui)}
                    onMouseEnter={e => applyHover(e, ui, true)}
                    onMouseLeave={e => applyHover(e, ui, false)}
                >
                    +
                </button>

                <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setDropdownOpen(o => !o)}
                        title="New tab options"
                        style={{
                            ...ctrlBtnStyle(ui),
                            fontSize:   10,
                            paddingTop: 2,
                            background: dropdownOpen ? ui.rowHover : 'none',
                            color:      dropdownOpen ? ui.text     : ui.subtext,
                        }}
                        onMouseEnter={e => applyHover(e, ui, true)}
                        onMouseLeave={e => { if (!dropdownOpen) applyHover(e, ui, false) }}
                    >
                        ▾
                    </button>

                    {dropdownOpen && (
                        <div style={{
                            position:     'absolute',
                            top:          'calc(100% + 6px)',
                            right:        0,
                            minWidth:     210,
                            background:   darkTheme ? '#2a2a2e' : '#ffffff',
                            border:       `1px solid ${ui.border}`,
                            borderRadius: 9,
                            boxShadow:    darkTheme
                                ? '0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)'
                                : '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
                            padding: '5px 0',
                            zIndex:  9999,
                        }}>

                            <MenuLabel label="Profiles" ui={ui} />
                            {profiles.map(p => (
                                <MenuItem
                                    key={p.id}
                                    label={p.name}
                                    ui={ui}
                                    onClick={() => { onAddSession('powershell', p); close() }}
                                />
                            ))}

                            <MenuSeparator ui={ui} />

                            {SHELL_DEFS.map(s => (
                                <MenuItem
                                    key={s.type}
                                    icon={TAB_ICONS[s.type]}
                                    label={s.label}
                                    ui={ui}
                                    onClick={() => { onAddSession(s.type); close() }}
                                />
                            ))}

                            <MenuSeparator ui={ui} />

                            <MenuItem
                                icon={settingsIcon}
                                label="Settings"
                                ui={ui}
                                onClick={() => { onOpenSettings(); close() }}
                            />
                        </div>
                    )}
                </div>
            </div>

        </div>
    )
}

function ctrlBtnStyle(ui: PanelTheme): React.CSSProperties {
    return {
        background:     'none',
        border:         'none',
        color:          ui.subtext,
        fontSize:       18,
        lineHeight:     1,
        width:          26,
        height:         26,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        0,
        borderRadius:   5,
        cursor:         'pointer',
        transition:     'color 0.15s, background 0.15s',
        flexShrink:     0,
    }
}

function applyHover(
    e: React.MouseEvent<HTMLButtonElement>,
    ui: PanelTheme,
    on: boolean,
) {
    e.currentTarget.style.color      = on ? ui.text     : ui.subtext
    e.currentTarget.style.background = on ? ui.rowHover : 'none'
}