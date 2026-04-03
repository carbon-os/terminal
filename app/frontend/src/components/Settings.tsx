import { useState } from 'react'
import {
  TerminalSettings, TerminalSession, Profile,
  DEFAULT_SETTINGS, PANEL_THEMES, THEME_PRESETS,
} from './types'
import TerminalTab  from './TerminalTab'
import ProfilesTab  from './ProfilesTab'
import './Settings.css'

type Tab = 'terminal' | 'profiles'

interface Props {
  settings:        TerminalSettings
  onChange:        (s: TerminalSettings) => void
  onClose:         () => void
  sessions:        TerminalSession[]
  activeSessionId: string
  onSelectSession: (id: string) => void
  onAddSession:    () => void
  onKillSession:   (id: string) => void
  onRenameSession: (id: string, name: string) => void
  profiles:        Profile[]
  onSaveProfile:   (name: string) => void
  onUpdateProfile: (id: string) => void
  onApplyProfile:  (profile: Profile) => void
  onDeleteProfile: (id: string) => void
  onRenameProfile: (id: string, name: string) => void
}

export default function Settings({
  settings, onChange, onClose,
  sessions, activeSessionId, onSelectSession, onAddSession, onKillSession, onRenameSession,
  profiles, onSaveProfile, onUpdateProfile, onApplyProfile, onDeleteProfile, onRenameProfile,
}: Props) {
  const ui     = PANEL_THEMES[settings.theme]
  const termBg = (THEME_PRESETS[settings.theme] as any).background as string
  const [tab, setTab] = useState<Tab>('terminal')

  const cssVars = {
    '--ct-accent':       ui.accent,
    '--ct-accent-muted': ui.accentMuted,
    '--ct-track-bg':     ui.trackBg,
    '--ct-thumb-bg':     '#ffffff',
    '--ct-border':       ui.border,
    '--ct-switch-on':    ui.switchOn,
  } as React.CSSProperties

  function TabButton({ id, label }: { id: Tab; label: string }) {
    const active = tab === id
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          flex:         1,
          background:   'none',
          border:       'none',
          borderBottom: active ? `2px solid ${ui.accent}` : '2px solid transparent',
          color:        active ? ui.text : ui.segActiveText,
          fontSize:     12,
          fontWeight:   active ? 600 : 400,
          fontFamily:   'system-ui, sans-serif',
          padding:      '10px 0',
          cursor:       'pointer',
          transition:   'color 0.15s, border-color 0.15s',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.color = ui.text }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.color = ui.segActiveText }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{
      ...cssVars,
      width:         300,
      height:        '100%',
      background:    termBg,
      borderLeft:    `1px solid ${ui.border}`,
      display:       'flex',
      flexDirection: 'column',
      transition:    'background 0.3s ease, border-color 0.3s ease',
    }}>

      {/* ── Header ── */}
      <div style={{
        background:   termBg,
        borderBottom: `1px solid ${ui.border}`,
        flexShrink:   0,
        transition:   'background 0.3s ease',
      }}>
        {/* Title row */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 20px 0',
        }}>
          <span style={{
            fontSize:      13,
            fontWeight:    600,
            color:         ui.text,
            fontFamily:    'system-ui, sans-serif',
            letterSpacing: '0.01em',
          }}>
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background:  'none',
              border:      'none',
              cursor:      'pointer',
              color:       ui.subtext,
              fontSize:    16,
              lineHeight:  1,
              padding:     '3px 5px',
              borderRadius: 5,
              transition:  'color 0.15s',
              fontFamily:  'system-ui',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = ui.text)}
            onMouseLeave={e => (e.currentTarget.style.color = ui.subtext)}
          >
            ✕
          </button>
        </div>

        {/* Tab row */}
        <div style={{
          display:   'flex',
          padding:   '0 20px',
          gap:       4,
          marginTop: 6,
        }}>
          <TabButton id="terminal" label="Terminal" />
          <TabButton id="profiles" label="Profiles" />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{
        flex:          1,
        overflowY:     'auto',
        padding:       '24px 20px 20px',
        fontFamily:    'system-ui, -apple-system, sans-serif',
        scrollbarWidth: 'thin',
        scrollbarColor: `${ui.scrollThumb} transparent`,
      }}>
        {tab === 'terminal' ? (
          <TerminalTab
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
            onAddSession={onAddSession}
            onKillSession={onKillSession}
            onRenameSession={onRenameSession}
            ui={ui}
          />
        ) : (
          <ProfilesTab
            settings={settings}
            onChange={onChange}
            profiles={profiles}
            onSaveProfile={onSaveProfile}
            onUpdateProfile={onUpdateProfile}
            onApplyProfile={onApplyProfile}
            onDeleteProfile={onDeleteProfile}
            onRenameProfile={onRenameProfile}
            ui={ui}
          />
        )}
      </div>

      {/* ── Footer (only on Profiles tab) ── */}
      {tab === 'profiles' && (
        <div style={{
          padding:    '14px 20px',
          background: termBg,
          borderTop:  `1px solid ${ui.border}`,
          flexShrink: 0,
          transition: 'background 0.3s ease',
        }}>
          <button
            onClick={() => onChange(DEFAULT_SETTINGS)}
            style={{
              width:        '100%',
              padding:      '8px 0',
              borderRadius: 7,
              background:   'transparent',
              border:       `1px solid ${ui.inputBorder}`,
              color:        ui.subtext,
              fontSize:     12,
              cursor:       'pointer',
              fontFamily:   'system-ui, sans-serif',
              transition:   'background 0.15s, color 0.15s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = ui.accentMuted
              e.currentTarget.style.color      = ui.text
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color      = ui.subtext
            }}
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  )
}