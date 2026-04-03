import * as RadixSlider from '@radix-ui/react-slider'
import { PanelTheme } from './types'

// ─── Layout atoms ─────────────────────────────────────────────────────────────

export function SectionLabel({ children, ui }: { children: React.ReactNode; ui: PanelTheme }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: ui.subtext,
      margin: '0 0 12px', fontFamily: 'system-ui, sans-serif',
    }}>
      {children}
    </p>
  )
}

export function FieldLabel({ children, ui }: { children: React.ReactNode; ui: PanelTheme }) {
  return (
    <label style={{
      display: 'block', fontSize: 12, fontWeight: 500,
      color: ui.text, marginBottom: 10,
      fontFamily: 'system-ui, sans-serif', opacity: 0.9,
    }}>
      {children}
    </label>
  )
}

export function Field({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 28 }}>{children}</div>
}

export function Divider({ ui }: { ui: PanelTheme }) {
  return <div style={{ borderTop: `1px solid ${ui.border}`, margin: '4px 0 28px' }} />
}

// ─── Slider ───────────────────────────────────────────────────────────────────

export function StyledSlider({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <RadixSlider.Root
      className="ct-slider-root"
      value={[value]} min={min} max={max} step={step}
      onValueChange={([v]) => onChange(v)}
    >
      <RadixSlider.Track className="ct-slider-track">
        <RadixSlider.Range className="ct-slider-range" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="ct-slider-thumb" aria-label="value" />
    </RadixSlider.Root>
  )
}

// ─── Segmented control ────────────────────────────────────────────────────────

export function SegmentedControl<T extends string>({
  value, options, onChange, ui,
}: {
  value: T
  options: { label: string; value: T }[]
  onChange: (v: T) => void
  ui: PanelTheme
}) {
  return (
    <div style={{
      display: 'flex', background: ui.inputBg,
      border: `1px solid ${ui.inputBorder}`,
      borderRadius: 7, overflow: 'hidden',
    }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, border: 'none', cursor: 'pointer',
              fontSize: 11.5, padding: '7px 4px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: active ? 600 : 400,
              background: active ? ui.segActiveBg : 'transparent',
              color: active ? ui.segActiveText : ui.subtext,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Inline-editable name ─────────────────────────────────────────────────────

export function InlineName({
  value, isEditing, onDoubleClick, onChange, onCommit, ui,
}: {
  value:         string
  isEditing:     boolean
  onDoubleClick: () => void
  onChange:      (v: string) => void
  onCommit:      () => void
  ui:            PanelTheme
}) {
  if (isEditing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') onCommit() }}
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1, minWidth: 0,
          background: ui.inputBg, border: `1px solid ${ui.accent}`,
          borderRadius: 4, color: ui.text, fontSize: 12,
          fontFamily: 'system-ui, sans-serif', padding: '1px 6px', outline: 'none',
        }}
      />
    )
  }
  return (
    <span
      onDoubleClick={onDoubleClick}
      title="Double-click to rename"
      style={{
        flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: 12, color: ui.text, fontFamily: 'system-ui, sans-serif',
        cursor: 'default', userSelect: 'none',
      }}
    >
      {value}
    </span>
  )
}

// ─── Icon button style helper ─────────────────────────────────────────────────

export function iconBtnStyle(ui: PanelTheme, danger = false): React.CSSProperties {
  return {
    background: 'none', border: 'none', cursor: 'pointer',
    color: danger ? '#e05555' : ui.subtext,
    fontSize: 13, lineHeight: 1,
    padding: '2px 4px', borderRadius: 4,
    fontFamily: 'system-ui', flexShrink: 0,
    transition: 'color 0.15s, background 0.15s',
  }
}