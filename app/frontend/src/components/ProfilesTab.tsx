import { useState } from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import {
  TerminalSettings, Profile, PanelTheme, SWATCHES, FONT_FAMILIES,
  THEME_PRESETS,
} from './types'
import {
  SectionLabel, FieldLabel, Field, Divider,
  StyledSlider, SegmentedControl, InlineName, iconBtnStyle,
} from './SettingsPrimitives'
import type { CursorStyle } from './types'

interface Props {
  settings:        TerminalSettings
  onChange:        (s: TerminalSettings) => void
  profiles:        Profile[]
  onSaveProfile:   (name: string) => void
  onUpdateProfile: (id: string) => void
  onApplyProfile:  (profile: Profile) => void
  onDeleteProfile: (id: string) => void
  onRenameProfile: (id: string, name: string) => void
  ui:              PanelTheme
}

export default function ProfilesTab({
  settings, onChange, profiles,
  onSaveProfile, onUpdateProfile, onApplyProfile, onDeleteProfile, onRenameProfile,
  ui,
}: Props) {
  const [editingId,        setEditingId]        = useState<string | null>(null)
  const [editingName,      setEditingName]      = useState('')
  const [newProfName,      setNewProfName]      = useState('')
  const [showNewProfInput, setShowNewProfInput] = useState(false)

  function set<K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) {
    onChange({ ...settings, [key]: value })
  }

  function startRename(profile: Profile) {
    setEditingId(profile.id)
    setEditingName(profile.name)
  }

  function commitRename() {
    if (editingId && editingName.trim()) onRenameProfile(editingId, editingName.trim())
    setEditingId(null)
  }

  return (
    <>
      {/* ══ Profiles ════════════════════════════════════════════════════════ */}
      <SectionLabel ui={ui}>Profiles</SectionLabel>

      <div style={{ marginBottom: 8 }}>
        {profiles.map(profile => {
          const isEditing = editingId === profile.id
          const isDefault = profile.id === 'default'
          return (
            <div
              key={profile.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 10px', borderRadius: 7, marginBottom: 3,
                background: 'transparent', border: '1px solid transparent',
              }}
            >
              <InlineName
                value={isEditing ? editingName : profile.name}
                isEditing={isEditing}
                onDoubleClick={() => !isDefault && startRename(profile)}
                onChange={setEditingName}
                onCommit={commitRename}
                ui={ui}
              />

              <button
                onClick={() => onApplyProfile(profile)}
                title="Apply this profile"
                style={{
                  background: ui.accentMuted, border: `1px solid ${ui.inputBorder}`,
                  borderRadius: 4, color: ui.text, fontSize: 10, fontWeight: 600,
                  padding: '2px 7px', cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif', flexShrink: 0,
                  letterSpacing: '0.03em', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = ui.segActiveBg)}
                onMouseLeave={e => (e.currentTarget.style.background = ui.accentMuted)}
              >
                Apply
              </button>

              <button
                onClick={() => onUpdateProfile(profile.id)}
                title="Overwrite with current settings"
                style={{ ...iconBtnStyle(ui), opacity: 0.5 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
              >
                ↺
              </button>

              {!isDefault && (
                <button
                  onClick={() => onDeleteProfile(profile.id)}
                  title="Delete profile"
                  style={{ ...iconBtnStyle(ui, true), opacity: 0.45 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>

      {showNewProfInput ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          <input
            autoFocus
            placeholder="Profile name…"
            value={newProfName}
            onChange={e => setNewProfName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newProfName.trim()) {
                onSaveProfile(newProfName.trim())
                setNewProfName('')
                setShowNewProfInput(false)
              }
              if (e.key === 'Escape') { setNewProfName(''); setShowNewProfInput(false) }
            }}
            style={{
              flex: 1, background: ui.inputBg, border: `1px solid ${ui.accent}`,
              borderRadius: 6, color: ui.text, fontSize: 12,
              fontFamily: 'system-ui, sans-serif', padding: '6px 10px', outline: 'none',
            }}
          />
          <button
            disabled={!newProfName.trim()}
            onClick={() => {
              if (!newProfName.trim()) return
              onSaveProfile(newProfName.trim())
              setNewProfName('')
              setShowNewProfInput(false)
            }}
            style={{
              background: ui.accentMuted, border: `1px solid ${ui.inputBorder}`,
              borderRadius: 6, color: ui.text, fontSize: 12, padding: '6px 12px',
              cursor: newProfName.trim() ? 'pointer' : 'default',
              fontFamily: 'system-ui, sans-serif',
              opacity: newProfName.trim() ? 1 : 0.4, transition: 'opacity 0.15s',
            }}
          >
            Save
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewProfInput(true)}
          style={{
            width: '100%', padding: '7px 10px', marginBottom: 28,
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
          + Save current as profile…
        </button>
      )}

      <Divider ui={ui} />

      {/* ══ Appearance ══════════════════════════════════════════════════════ */}
      <SectionLabel ui={ui}>Appearance</SectionLabel>

      <Field>
        <FieldLabel ui={ui}>Theme</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {SWATCHES.map(sw => {
            const selected = settings.theme === sw.preset
            return (
              <button
                key={sw.preset}
                onClick={() => set('theme', sw.preset)}
                style={{
                  background:    ui.accentMuted,
                  border:        selected ? `2px solid ${ui.accent}` : '2px solid transparent',
                  borderRadius:  8,
                  padding:       '11px 12px',
                  cursor:        'pointer',
                  textAlign:     'left',
                  outline:       selected ? `3px solid ${ui.accentMuted}` : 'none',
                  outlineOffset: 1,
                  transition:    'border-color 0.15s, outline 0.15s',
                  display:       'flex', flexDirection: 'column', gap: 5,
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 700, color: ui.text,
                  fontFamily: 'system-ui, sans-serif', letterSpacing: '0.02em',
                }}>
                  {sw.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 400, color: ui.subtext,
                  fontFamily: 'monospace', letterSpacing: '0.04em',
                }}>
                  {(THEME_PRESETS[sw.preset] as any).background}
                </span>
              </button>
            )
          })}
        </div>
      </Field>

      <Divider ui={ui} />

      {/* ══ Font ════════════════════════════════════════════════════════════ */}
      <SectionLabel ui={ui}>Font</SectionLabel>

      <Field>
        <FieldLabel ui={ui}>Family</FieldLabel>
        <select
          value={settings.fontFamily}
          onChange={e => set('fontFamily', e.target.value)}
          style={{
            width: '100%', background: ui.inputBg,
            border: `1px solid ${ui.inputBorder}`, borderRadius: 7,
            color: ui.text, fontSize: 12, padding: '7px 10px',
            outline: 'none', cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif', appearance: 'none',
          }}
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </Field>

      <Field>
        <FieldLabel ui={ui}>
          Size
          <span style={{ float: 'right', color: ui.accent, fontVariantNumeric: 'tabular-nums' }}>
            {settings.fontSize}px
          </span>
        </FieldLabel>
        <StyledSlider value={settings.fontSize} min={8} max={24} step={1}
          onChange={v => set('fontSize', v)} />
      </Field>

      <Field>
        <FieldLabel ui={ui}>
          Line Height
          <span style={{ float: 'right', color: ui.accent, fontVariantNumeric: 'tabular-nums' }}>
            {settings.lineHeight.toFixed(2)}
          </span>
        </FieldLabel>
        <StyledSlider value={settings.lineHeight} min={1} max={2} step={0.05}
          onChange={v => set('lineHeight', parseFloat(v.toFixed(2)))} />
      </Field>

      <Field>
        <FieldLabel ui={ui}>
          Letter Spacing
          <span style={{ float: 'right', color: ui.accent, fontVariantNumeric: 'tabular-nums' }}>
            {settings.letterSpacing}px
          </span>
        </FieldLabel>
        <StyledSlider value={settings.letterSpacing} min={-2} max={6} step={0.5}
          onChange={v => set('letterSpacing', v)} />
      </Field>

      <Divider ui={ui} />

      {/* ══ Cursor ══════════════════════════════════════════════════════════ */}
      <SectionLabel ui={ui}>Cursor</SectionLabel>

      <Field>
        <FieldLabel ui={ui}>Style</FieldLabel>
        <SegmentedControl<CursorStyle>
          value={settings.cursorStyle}
          options={[
            { label: '█  Block', value: 'block' },
            { label: '_  Under', value: 'underline' },
            { label: '|  Bar',   value: 'bar' },
          ]}
          onChange={v => set('cursorStyle', v)}
          ui={ui}
        />
      </Field>

      <Field>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FieldLabel ui={ui}>Blink</FieldLabel>
          <RadixSwitch.Root
            className="ct-switch-root"
            checked={settings.cursorBlink}
            onCheckedChange={v => set('cursorBlink', v)}
          >
            <RadixSwitch.Thumb className="ct-switch-thumb" />
          </RadixSwitch.Root>
        </div>
      </Field>

      <Divider ui={ui} />

      {/* ══ Scrollback ══════════════════════════════════════════════════════ */}
      <SectionLabel ui={ui}>Scrollback</SectionLabel>

      <Field>
        <FieldLabel ui={ui}>
          Buffer Lines
          <span style={{ float: 'right', color: ui.accent, fontVariantNumeric: 'tabular-nums' }}>
            {settings.scrollback.toLocaleString()}
          </span>
        </FieldLabel>
        <StyledSlider value={settings.scrollback} min={100} max={10000} step={100}
          onChange={v => set('scrollback', v)} />
      </Field>
    </>
  )
}