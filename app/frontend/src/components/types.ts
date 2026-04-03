// ─── Types ────────────────────────────────────────────────────────────────────

export type CursorStyle = 'block' | 'underline' | 'bar'
export type ThemePreset = 'dark' | 'vscode' | 'monokai' | 'dracula' | 'light'

export interface TerminalSettings {
  fontSize:      number
  fontFamily:    string
  lineHeight:    number
  letterSpacing: number
  cursorStyle:   CursorStyle
  cursorBlink:   boolean
  scrollback:    number
  theme:         ThemePreset
}

export interface TerminalSession {
  id:   string
  name: string
}

export interface Profile {
  id:       string
  name:     string
  settings: TerminalSettings
}

// ─── Font families ────────────────────────────────────────────────────────────
// system: true  → already on the OS, document.fonts.load() not needed
// system: false → loaded via @fontsource, must await document.fonts.load()

export interface FontFamily {
  label:  string
  value:  string
  system: boolean
}

export const FONT_FAMILIES: FontFamily[] = [
  { label: 'Menlo / Monaco',   value: "Menlo, Monaco, 'Courier New', monospace", system: true  },
  { label: 'JetBrains Mono',   value: "'JetBrains Mono', monospace",             system: false },
  { label: 'Fira Code',        value: "'Fira Code', monospace",                  system: false },
  { label: 'Source Code Pro',  value: "'Source Code Pro', monospace",            system: false },
  { label: 'IBM Plex Mono',    value: "'IBM Plex Mono', monospace",              system: false },
  { label: 'Inconsolata',      value: "'Inconsolata', monospace",                system: false },
  { label: 'Ubuntu Mono',      value: "'Ubuntu Mono', monospace",                system: false },
  { label: 'Consolas',         value: "Consolas, 'Courier New', monospace",      system: true  },
  { label: 'System Monospace', value: 'monospace',                               system: true  },
]

// ─── Panel UI theme ───────────────────────────────────────────────────────────

export interface PanelTheme {
  panelBg:       string
  headerBg:      string
  footerBg:      string
  border:        string
  text:          string
  subtext:       string
  inputBg:       string
  inputBorder:   string
  accent:        string
  accentMuted:   string
  switchOn:      string
  trackBg:       string
  segActiveBg:   string
  segActiveText: string
  scrollThumb:   string
  rowHover:      string
  activeBg:      string
}

// ─── Terminal theme presets ───────────────────────────────────────────────────

export const THEME_PRESETS: Record<ThemePreset, object> = {
  dark: {
    background: '#1a1a1a', foreground: '#d4d4d4', cursor: '#d4d4d4',
    black: '#1a1a1a', red: '#f44747', green: '#6a9955', yellow: '#dcdcaa',
    blue: '#569cd6', magenta: '#c586c0', cyan: '#9cdcfe', white: '#d4d4d4',
    brightBlack: '#555555', brightRed: '#f44747', brightGreen: '#b5cea8',
    brightYellow: '#dcdcaa', brightBlue: '#569cd6', brightMagenta: '#daadd6',
    brightCyan: '#9cdcfe', brightWhite: '#ffffff',
  },
  vscode: {
    background: '#1e1e1e', foreground: '#cccccc', cursor: '#aeafad',
    black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
    blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
    brightBlack: '#555555', brightRed: '#f14c4c', brightGreen: '#23d18b',
    brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6',
    brightCyan: '#29b8db', brightWhite: '#e5e5e5',
  },
  monokai: {
    background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0',
    black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75',
    blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
    brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e',
    brightYellow: '#f4bf75', brightBlue: '#66d9ef', brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4', brightWhite: '#f9f8f5',
  },
  dracula: {
    background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f2',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
    brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
    brightCyan: '#a4ffff', brightWhite: '#ffffff',
  },
  light: {
    background: '#ffffff', foreground: '#333333', cursor: '#333333',
    black: '#000000', red: '#cd3131', green: '#00bc00', yellow: '#949800',
    blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc', white: '#555555',
    brightBlack: '#555555', brightRed: '#cd3131', brightGreen: '#14ce14',
    brightYellow: '#b5ba00', brightBlue: '#0451a5', brightMagenta: '#bc05bc',
    brightCyan: '#0598bc', brightWhite: '#a5a5a5',
  },
}

export const DEFAULT_SETTINGS: TerminalSettings = {
  fontSize:      13,
  fontFamily:    "Menlo, Monaco, 'Courier New', monospace",
  lineHeight:    1.25,
  letterSpacing: 0,
  cursorStyle:   'block',
  cursorBlink:   true,
  scrollback:    1000,
  theme:         'dark',
}

// ─── Panel UI themes ──────────────────────────────────────────────────────────

export const PANEL_THEMES: Record<ThemePreset, PanelTheme> = {
  dark: {
    panelBg:       '#161618',
    headerBg:      '#1c1c1e',
    footerBg:      '#131315',
    border:        'rgba(255,255,255,0.07)',
    text:          '#e2e2e2',
    subtext:       '#4e4e4e',
    inputBg:       '#0f0f11',
    inputBorder:   'rgba(255,255,255,0.08)',
    accent:        '#888888',
    accentMuted:   'rgba(255,255,255,0.07)',
    switchOn:      '#555555',
    trackBg:       'rgba(255,255,255,0.1)',
    segActiveBg:   'rgba(255,255,255,0.08)',
    segActiveText: '#cccccc',
    scrollThumb:   'rgba(255,255,255,0.1)',
    rowHover:      'rgba(255,255,255,0.04)',
    activeBg:      'rgba(255,255,255,0.07)',
  },
  vscode: {
    panelBg:       '#1e1e1e',
    headerBg:      '#252526',
    footerBg:      '#1a1a1a',
    border:        'rgba(255,255,255,0.07)',
    text:          '#cccccc',
    subtext:       '#4a4a4a',
    inputBg:       '#1a1a1a',
    inputBorder:   'rgba(255,255,255,0.08)',
    accent:        '#888888',
    accentMuted:   'rgba(255,255,255,0.07)',
    switchOn:      '#555555',
    trackBg:       'rgba(255,255,255,0.1)',
    segActiveBg:   'rgba(255,255,255,0.08)',
    segActiveText: '#cccccc',
    scrollThumb:   'rgba(255,255,255,0.1)',
    rowHover:      'rgba(255,255,255,0.04)',
    activeBg:      'rgba(255,255,255,0.07)',
  },
  monokai: {
    panelBg:       '#1e1f19',
    headerBg:      '#272822',
    footerBg:      '#191a14',
    border:        'rgba(255,255,255,0.06)',
    text:          '#f8f8f2',
    subtext:       '#4a4a42',
    inputBg:       '#191a14',
    inputBorder:   'rgba(255,255,255,0.07)',
    accent:        '#888888',
    accentMuted:   'rgba(255,255,255,0.07)',
    switchOn:      '#555555',
    trackBg:       'rgba(255,255,255,0.1)',
    segActiveBg:   'rgba(255,255,255,0.08)',
    segActiveText: '#cccccc',
    scrollThumb:   'rgba(255,255,255,0.1)',
    rowHover:      'rgba(255,255,255,0.04)',
    activeBg:      'rgba(255,255,255,0.07)',
  },
  dracula: {
    panelBg:       '#1a1b26',
    headerBg:      '#21222c',
    footerBg:      '#161720',
    border:        'rgba(255,255,255,0.07)',
    text:          '#f8f8f2',
    subtext:       '#3d4466',
    inputBg:       '#16171f',
    inputBorder:   'rgba(255,255,255,0.08)',
    accent:        '#888888',
    accentMuted:   'rgba(255,255,255,0.07)',
    switchOn:      '#555555',
    trackBg:       'rgba(255,255,255,0.1)',
    segActiveBg:   'rgba(255,255,255,0.08)',
    segActiveText: '#cccccc',
    scrollThumb:   'rgba(255,255,255,0.1)',
    rowHover:      'rgba(255,255,255,0.04)',
    activeBg:      'rgba(255,255,255,0.07)',
  },
  light: {
    panelBg:       '#f4f4f6',
    headerBg:      '#ffffff',
    footerBg:      '#ebebed',
    border:        'rgba(0,0,0,0.08)',
    text:          '#1a1a1a',
    subtext:       '#aaaaaa',
    inputBg:       '#ffffff',
    inputBorder:   'rgba(0,0,0,0.1)',
    accent:        '#555555',
    accentMuted:   'rgba(0,0,0,0.06)',
    switchOn:      '#777777',
    trackBg:       'rgba(0,0,0,0.1)',
    segActiveBg:   'rgba(0,0,0,0.07)',
    segActiveText: '#222222',
    scrollThumb:   'rgba(0,0,0,0.12)',
    rowHover:      'rgba(0,0,0,0.03)',
    activeBg:      'rgba(0,0,0,0.06)',
  },
}

// ─── Theme swatch data ────────────────────────────────────────────────────────

export const SWATCHES: {
  preset: ThemePreset; label: string; bg: string; fg: string; accentText: string
}[] = [
  { preset: 'dark',    label: 'Dark',    bg: '#1a1a1a',           fg: 'rgba(255,255,255,0.15)', accentText: 'rgba(255,255,255,0.5)' },
  { preset: 'vscode',  label: 'VS Code', bg: '#1e1e1e',           fg: 'rgba(255,255,255,0.15)', accentText: 'rgba(255,255,255,0.5)' },
  { preset: 'monokai', label: 'Monokai', bg: '#272822',           fg: 'rgba(255,255,255,0.15)', accentText: 'rgba(255,255,255,0.5)' },
  { preset: 'dracula', label: 'Mode V2', bg: '#282a36',           fg: 'rgba(255,255,255,0.15)', accentText: 'rgba(255,255,255,0.5)' },
  { preset: 'light',   label: 'Light',   bg: 'rgba(0,0,0,0.04)', fg: 'rgba(0,0,0,0.1)',        accentText: 'rgba(0,0,0,0.35)'      },
]