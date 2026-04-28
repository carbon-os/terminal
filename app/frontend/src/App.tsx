import { useState, useCallback, useEffect, useRef } from 'react'
import TerminalView from './components/Terminal'
import BrowserTabs  from './components/BrowserTabs'
import Settings     from './components/Settings'
import {
    TerminalSettings, DEFAULT_SETTINGS, THEME_PRESETS, PANEL_THEMES,
    TerminalSession, Profile, ShellType, SHELL_DEFS,
} from './components/types'
import { ipc } from './ipc/client'

const dec = new TextDecoder()

export default function App() {
    const [settings, setSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS)

    const [sessions, setSessions] = useState<TerminalSession[]>(() => [
        { id: crypto.randomUUID(), name: 'Windows PowerShell', shell: 'powershell', kind: 'terminal' },
    ])
    const [activeId, setActiveId] = useState(() => sessions[0].id)

    const [profiles, setProfiles] = useState<Profile[]>([
        { id: 'default', name: 'Default', settings: DEFAULT_SETTINGS },
    ])

    const profilesReady    = useRef(false)
    const settingsReady    = useRef(false)
    const skipProfileSave  = useRef(false)
    const skipSettingsSave = useRef(false)

    // ── Prefs load on mount ───────────────────────────────────────────────────
    useEffect(() => {
        const unsubProfiles = ipc.on('prefs.profiles.data', (buf) => {
            try {
                const saved: Profile[] = JSON.parse(dec.decode(new Uint8Array(buf)))
                if (Array.isArray(saved) && saved.length > 0) {
                    skipProfileSave.current = true
                    setProfiles(saved)
                }
            } catch { }
            profilesReady.current = true
        })

        const unsubSettings = ipc.on('prefs.settings.data', (buf) => {
            try {
                const saved = JSON.parse(dec.decode(new Uint8Array(buf))) as Partial<TerminalSettings>
                if (saved && Object.keys(saved).length > 0) {
                    skipSettingsSave.current = true
                    setSettings(prev => ({ ...prev, ...saved }))
                }
            } catch { }
            settingsReady.current = true
        })

        ipc.sendJSON('prefs.profiles.load', '', null)
        ipc.sendJSON('prefs.settings.load', '', null)

        return () => { unsubProfiles(); unsubSettings() }
    }, [])

    // ── Prefs auto-save ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!profilesReady.current) return
        if (skipProfileSave.current) { skipProfileSave.current = false; return }
        ipc.sendJSON('prefs.profiles.save', '', profiles)
    }, [profiles])

    useEffect(() => {
        if (!settingsReady.current) return
        if (skipSettingsSave.current) { skipSettingsSave.current = false; return }
        ipc.sendJSON('prefs.settings.save', '', settings)
    }, [settings])

    // ── Theme-derived values ──────────────────────────────────────────────────
    const termBg    = (THEME_PRESETS[settings.theme] as any).background as string
    const ui        = PANEL_THEMES[settings.theme]
    const isLight   = settings.theme === 'light'
    const topBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)'

    // ── Session handlers ──────────────────────────────────────────────────────
    const addSession = useCallback((
        shell: ShellType = 'powershell',
        profile?: Profile,
    ) => {
        if (profile) setSettings(profile.settings)
        const id    = crypto.randomUUID()
        const label = SHELL_DEFS.find(s => s.type === shell)?.label ?? 'Terminal'
        setSessions(prev => [...prev, { id, name: label, shell, kind: 'terminal' }])
        setActiveId(id)
    }, [])

    const killSession = useCallback((id: string) => {
        setSessions(prev => {
            if (prev.length === 1) return prev
            const next = prev.filter(s => s.id !== id)
            if (activeId === id) setActiveId(next[next.length - 1].id)
            return next
        })
    }, [activeId])

    // ── Settings tab ──────────────────────────────────────────────────────────
    const openSettings = useCallback(() => {
        setSessions(prev => {
            const existing = prev.find(s => s.kind === 'settings')
            if (existing) {
                setActiveId(existing.id)
                return prev
            }
            const id = crypto.randomUUID()
            setActiveId(id)
            return [...prev, { id, name: 'Settings', shell: 'powershell', kind: 'settings' }]
        })
    }, [])

    // ── Profile handlers ──────────────────────────────────────────────────────
    const saveProfile   = useCallback((name: string) => {
        setProfiles(prev => [...prev, { id: crypto.randomUUID(), name, settings }])
    }, [settings])

    const updateProfile = useCallback((id: string) => {
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, settings } : p))
    }, [settings])

    const applyProfile  = useCallback((profile: Profile) => setSettings(profile.settings), [])

    const deleteProfile = useCallback((id: string) => {
        if (id === 'default') return
        setProfiles(prev => prev.filter(p => p.id !== id))
    }, [])

    const renameProfile = useCallback((id: string, name: string) => {
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, name } : p))
    }, [])

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{
            display:       'flex',
            flexDirection: 'column',
            width:         '100vw',
            height:        '100vh',
            background:    termBg,
            overflow:      'hidden',
            transition:    'background 0.3s ease',
            borderTop:     `1px solid ${topBorder}`,
        }}>
            <BrowserTabs
                sessions={sessions}
                activeSessionId={activeId}
                onSelectSession={setActiveId}
                onAddSession={addSession}
                onKillSession={killSession}
                onOpenSettings={openSettings}
                profiles={profiles}
                darkTheme={!isLight}
                ui={ui}
                termBg={termBg}
            />

            {/* Panes: kept mounted so xterm is never destroyed */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                {sessions.map(session => (
                    <div
                        key={session.id}
                        style={{
                            position:      'absolute',
                            inset:         0,
                            display:       'flex',
                            flexDirection: 'column',
                            overflow:      'hidden',
                            // visibility swap instead of display:none so xterm
                            // always has real pixel dimensions in the layout tree
                            visibility:    session.id === activeId ? 'visible' : 'hidden',
                            pointerEvents: session.id === activeId ? 'auto'    : 'none',
                        }}
                    >
                        {session.kind === 'settings' ? (
                            <Settings
                                settings={settings}
                                onChange={setSettings}
                                profiles={profiles}
                                onSaveProfile={saveProfile}
                                onUpdateProfile={updateProfile}
                                onApplyProfile={applyProfile}
                                onDeleteProfile={deleteProfile}
                                onRenameProfile={renameProfile}
                            />
                        ) : (
                            <TerminalView
                                settings={settings}
                                sessionId={session.id}
                                shell={session.shell}
                                isActive={session.id === activeId}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}