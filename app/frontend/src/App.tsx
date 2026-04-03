import { useState, useCallback, useEffect, useRef } from 'react'
import TerminalView from './components/Terminal'
import Settings from './components/Settings'
import {
  TerminalSettings, DEFAULT_SETTINGS, THEME_PRESETS,
  TerminalSession, Profile,
} from './components/types'
import { RiSettings3Line } from 'react-icons/ri'

const enc = new TextEncoder()
const dec = new TextDecoder()

function ipcSendJSON(channel: string, value: unknown) {
  window.ipc.send(channel, enc.encode(JSON.stringify(value)).buffer as ArrayBuffer)
}

export default function App() {
  const [settings, setSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS)
  const [open, setOpen] = useState(false)

  const [sessions, setSessions] = useState<TerminalSession[]>(() => [
    { id: crypto.randomUUID(), name: 'Terminal 1' },
  ])
  const [activeId, setActiveId] = useState(() => sessions[0].id)

  const [profiles, setProfiles] = useState<Profile[]>([
    { id: 'default', name: 'Default', settings: DEFAULT_SETTINGS },
  ])

  const profilesReady = useRef(false)
  const settingsReady = useRef(false)
  const skipProfileSave = useRef(false)
  const skipSettingsSave = useRef(false)

  useEffect(() => {
    window.ipc.on('prefs.profiles.data', (buf: ArrayBuffer) => {
      try {
        const saved: Profile[] = JSON.parse(dec.decode(new Uint8Array(buf)))
        if (Array.isArray(saved) && saved.length > 0) {
          skipProfileSave.current = true
          setProfiles(saved)
        }
      } catch { }
      profilesReady.current = true
    })

    window.ipc.on('prefs.settings.data', (buf: ArrayBuffer) => {
      try {
        const saved = JSON.parse(dec.decode(new Uint8Array(buf))) as Partial<TerminalSettings>
        if (saved && Object.keys(saved).length > 0) {
          skipSettingsSave.current = true
          setSettings(prev => ({ ...prev, ...saved }))
        }
      } catch { }
      settingsReady.current = true
    })

    ipcSendJSON('prefs.profiles.load', null)
    ipcSendJSON('prefs.settings.load', null)
  }, [])

  useEffect(() => {
    if (!profilesReady.current) return
    if (skipProfileSave.current) { skipProfileSave.current = false; return }
    ipcSendJSON('prefs.profiles.save', profiles)
  }, [profiles])

  useEffect(() => {
    if (!settingsReady.current) return
    if (skipSettingsSave.current) { skipSettingsSave.current = false; return }
    ipcSendJSON('prefs.settings.save', settings)
  }, [settings])

  const termBg = (THEME_PRESETS[settings.theme] as any).background as string
  const isLight = settings.theme === 'light'
  const topBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)'
  const btnBase = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)'
  const btnHover = isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.18)'
  const btnBorder = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.15)'
  const btnColor = isLight ? '#444' : '#aaa'
  const btnColorHover = isLight ? '#000' : '#fff'

  const addSession = useCallback(() => {
    const id = crypto.randomUUID()
    setSessions(prev => [...prev, { id, name: `Terminal ${prev.length + 1}` }])
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

  const renameSession = useCallback((id: string, name: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }, [])

  const saveProfile = useCallback((name: string) => {
    setProfiles(prev => [...prev, { id: crypto.randomUUID(), name, settings }])
  }, [settings])

  const updateProfile = useCallback((id: string) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, settings } : p))
  }, [settings])

  const applyProfile = useCallback((profile: Profile) => {
    setSettings(profile.settings)
  }, [])

  const deleteProfile = useCallback((id: string) => {
    if (id === 'default') return
    setProfiles(prev => prev.filter(p => p.id !== id))
  }, [])

  const renameProfile = useCallback((id: string, name: string) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, name } : p))
  }, [])

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      background: termBg,
      overflow: 'hidden',
      transition: 'background 0.3s ease',
      borderTop: `1px solid ${topBorder}`,
    }}>

      {/* ── Terminal ── */}
      {/* ── Terminal ── */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {sessions.map(session => (
          <div
            key={session.id}
            style={{
              position: 'absolute', inset: 0,
              display: session.id === activeId ? 'block' : 'none',
            }}
          >
            <TerminalView settings={settings} sessionId={session.id} />
          </div>
        ))}
      </div>

      {/* ── Settings button ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        padding: '10px 6px',
      }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Settings"
          style={{
            background: btnBase,
            border: `1px solid ${btnBorder}`,
            borderRadius: 6,
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: btnColor,
            padding: 0,
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = btnHover
            e.currentTarget.style.color = btnColorHover
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = btnBase
            e.currentTarget.style.color = btnColor
          }}
        >
          <RiSettings3Line size={15} />
        </button>
      </div>

      {/* ── Settings panel ── */}
      <div style={{
        width: open ? 300 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <Settings
          settings={settings}
          onChange={setSettings}
          onClose={() => setOpen(false)}
          sessions={sessions}
          activeSessionId={activeId}
          onSelectSession={setActiveId}
          onAddSession={addSession}
          onKillSession={killSession}
          onRenameSession={renameSession}
          profiles={profiles}
          onSaveProfile={saveProfile}
          onUpdateProfile={updateProfile}
          onApplyProfile={applyProfile}
          onDeleteProfile={deleteProfile}
          onRenameProfile={renameProfile}
        />
      </div>
    </div>
  )
}