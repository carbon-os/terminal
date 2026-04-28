import {
    TerminalSettings, Profile,
    DEFAULT_SETTINGS, PANEL_THEMES, THEME_PRESETS,
} from './types'
import ProfilesTab from './ProfilesTab'
import './Settings.css'

interface Props {
    settings:        TerminalSettings
    onChange:        (s: TerminalSettings) => void
    profiles:        Profile[]
    onSaveProfile:   (name: string) => void
    onUpdateProfile: (id: string) => void
    onApplyProfile:  (profile: Profile) => void
    onDeleteProfile: (id: string) => void
    onRenameProfile: (id: string, name: string) => void
}

export default function Settings({
    settings, onChange,
    profiles, onSaveProfile, onUpdateProfile, onApplyProfile, onDeleteProfile, onRenameProfile,
}: Props) {
    const ui     = PANEL_THEMES[settings.theme]
    const termBg = (THEME_PRESETS[settings.theme] as any).background as string

    const cssVars = {
        '--ct-accent':       ui.accent,
        '--ct-accent-muted': ui.accentMuted,
        '--ct-track-bg':     ui.trackBg,
        '--ct-thumb-bg':     '#ffffff',
        '--ct-border':       ui.border,
        '--ct-switch-on':    ui.switchOn,
    } as React.CSSProperties

    return (
        <div style={{
            ...cssVars,
            width:         '100%',
            height:        '100%',
            background:    termBg,
            display:       'flex',
            flexDirection: 'column',
            transition:    'background 0.3s ease',
            overflow:      'hidden',
        }}>

            {/* ── Centered content column ── */}
            <div style={{
                flex:           1,
                overflowY:      'auto',
                display:        'flex',
                justifyContent: 'center',
                scrollbarWidth: 'thin',
                scrollbarColor: `${ui.scrollThumb} transparent`,
            }}>
                <div style={{
                    width:     '100%',
                    maxWidth:  640,
                    padding:   '40px 32px 32px',
                    boxSizing: 'border-box',
                }}>

                    {/* Page heading */}
                    <h1 style={{
                        fontSize:      22,
                        fontWeight:    600,
                        color:         ui.text,
                        fontFamily:    'system-ui, sans-serif',
                        margin:        '0 0 32px',
                        letterSpacing: '-0.01em',
                    }}>
                        Settings
                    </h1>

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
                </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
                borderTop:  `1px solid ${ui.border}`,
                padding:    '14px 32px',
                display:    'flex',
                justifyContent: 'center',
                background: termBg,
                flexShrink: 0,
                transition: 'background 0.3s ease',
            }}>
                <div style={{ width: '100%', maxWidth: 640 }}>
                    <button
                        onClick={() => onChange(DEFAULT_SETTINGS)}
                        style={{
                            padding:       '8px 18px',
                            borderRadius:  7,
                            background:    'transparent',
                            border:        `1px solid ${ui.inputBorder}`,
                            color:         ui.subtext,
                            fontSize:      12,
                            cursor:        'pointer',
                            fontFamily:    'system-ui, sans-serif',
                            transition:    'background 0.15s, color 0.15s',
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
            </div>
        </div>
    )
}