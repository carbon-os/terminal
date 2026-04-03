import { useState } from 'react'
import { PanelTheme, TerminalSession } from './types'
import { InlineName, iconBtnStyle } from './SettingsPrimitives'

interface Props {
  sessions:        TerminalSession[]
  activeSessionId: string
  onSelectSession: (id: string) => void
  onAddSession:    () => void
  onKillSession:   (id: string) => void
  onRenameSession: (id: string, name: string) => void
  ui:              PanelTheme
}

export default function TerminalTab({
  sessions, activeSessionId, onSelectSession, onAddSession, onKillSession, onRenameSession, ui,
}: Props) {
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  function startRename(session: TerminalSession) {
    setEditingId(session.id)
    setEditingName(session.name)
  }

  function commitRename() {
    if (editingId && editingName.trim()) onRenameSession(editingId, editingName.trim())
    setEditingId(null)
  }

  return (
    <div>
      {sessions.map(session => {
        const isActive  = session.id === activeSessionId
        const isEditing = editingId === session.id
        return (
          <div
            key={session.id}
            onClick={() => !isEditing && onSelectSession(session.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 7, marginBottom: 3,
              cursor: isEditing ? 'default' : 'pointer',
              background: isActive ? ui.activeBg : 'transparent',
              border: isActive ? `1px solid ${ui.inputBorder}` : '1px solid transparent',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = ui.rowHover
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: isActive ? ui.accent : ui.subtext,
              opacity: isActive ? 1 : 0.4, transition: 'background 0.15s',
            }} />

            <InlineName
              value={isEditing ? editingName : session.name}
              isEditing={isEditing}
              onDoubleClick={() => startRename(session)}
              onChange={setEditingName}
              onCommit={commitRename}
              ui={ui}
            />

            <button
              onClick={e => { e.stopPropagation(); onKillSession(session.id) }}
              disabled={sessions.length === 1}
              title="Close terminal"
              style={{ ...iconBtnStyle(ui), opacity: sessions.length === 1 ? 0.2 : 0.5 }}
              onMouseEnter={e => { if (sessions.length > 1) e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = sessions.length === 1 ? '0.2' : '0.5' }}
            >
              ✕
            </button>
          </div>
        )
      })}

      <button
        onClick={onAddSession}
        style={{
          width: '100%', padding: '7px 10px', marginTop: 4,
          background: 'transparent', border: `1px solid ${ui.inputBorder}`,
          borderRadius: 7, color: ui.subtext, fontSize: 12,
          cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
          textAlign: 'left', transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = ui.rowHover
          e.currentTarget.style.color      = ui.text
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color      = ui.subtext
        }}
      >
        + New Terminal
      </button>
    </div>
  )
}