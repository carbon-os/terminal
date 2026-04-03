<h1 align="center">
  <a href="https://github.com/carbon-os/terminal">
    <img src="./resources/assets/logo.png" alt="Carbon Terminal" height="150px">
  </a>
  <br>
  Carbon Terminal
  <br>
</h1>

<h4 align="center">A modern, high-performance, general-purpose terminal for macOS, carbonOS, Linux, and Windows</h4>

<p align="center">
  <a href="https://github.com/carbon-os/terminal">
    <img src="https://img.shields.io/badge/Carbon%20Terminal-ObjC%20%2F%20C%2B%2B%20%2F%20TypeScript-blue.svg?longCache=true" alt="Carbon Terminal" />
  </a>
  <a href="https://github.com/carbon-os/terminal">
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20carbonOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg" alt="Platforms" />
  </a>
  <br>
  <a href="https://github.com/carbon-os/terminal">
    <img src="https://img.shields.io/static/v1?label=renderer&message=xterm.js&color=brightgreen" />
  </a>
  <a href="https://github.com/carbon-os/terminal">
    <img src="https://img.shields.io/static/v1?label=shell&message=PTY%20%2F%20forkpty&color=brightgreen" />
  </a>
  <a href="https://github.com/carbon-os/terminal">
    <img src="https://img.shields.io/static/v1?label=color&message=xterm-256color&color=brightgreen" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-5865F2.svg" alt="License: MIT" />
  </a>
</p>

<br>

---

## Features

- **High performance rendering** — powered by xterm.js with a fully hardware-accelerated canvas backend
- **Native PTY integration** — true pseudoterminal support with full resize, signal, and session lifecycle handling
- **Multi-session architecture** — each terminal tab runs an isolated PTY session identified by UUID
- **True color support** — full xterm-256color and 24-bit RGB color support out of the box
- **Clipboard integration** — native read/write clipboard bridged directly from the terminal layer
- **Responsive layout** — ResizeObserver-driven fit engine keeps the terminal perfectly sized at all times
- **Minimal chrome** — transparent titlebar, clean dark theme, no clutter
- **Extensible IPC bridge** — a structured channel-based message bus connects the native layer and the web frontend, making new features straightforward to add

---

## Platform Support

| Platform   | Status               |
|------------|----------------------|
| macOS      | ✅ Supported (13.0+)  |
| carbonOS   | ✅ Supported          |
| Linux      | ✅ Supported          |
| Windows    | ✅ Supported          |

---

## Architecture

Carbon Terminal is split into two layers that communicate over a structured IPC bus:

```
┌─────────────────────────────────────┐
│         Web Frontend (React)        │
│  xterm.js · FitAddon · IPC client   │
└────────────────┬────────────────────┘
                 │  window.ipc  (channel-based)
┌────────────────┴────────────────────┐
│         Native Layer (ObjC/C++)     │
│  WKWebView · PtyManager · IPC host  │
└─────────────────────────────────────┘
```

**Native layer** — written in Objective-C, manages the app window, PTY lifecycle (`forkpty`/`execl`),
and all OS-level resources. The IPC host bridges named channels between the shell process and the webview.

**Web frontend** — a React + TypeScript app bundled with Vite. xterm.js handles all terminal
rendering and user input. It communicates with the native layer exclusively through the
`window.ipc` bridge — no Node.js, no Electron.

---

## Getting Started

### Prerequisites

- macOS 13.0 or later
- Xcode Command Line Tools
- CMake ≥ 3.22
- Ninja
- Node.js ≥ 18

### Build

```bash
git clone https://github.com/carbon-os/terminal.git
cd terminal
./build.sh
```

The build script will:
1. Generate the app icon from `resources/assets/logo.png`
2. Build and bundle the React frontend via Vite
3. Configure and compile the native app with CMake + Ninja
4. Codesign the `.app` bundle

The finished app lands at:
```
./build/CarbonTerminal.app
```

### Development (hot reload)

Start the Vite dev server before launching the app. In debug builds the webview
loads from `http://localhost:5173` instead of the embedded bundle:

```bash
cd app/frontend
npm install
npm run dev
```

Then in a separate terminal:

```bash
./build.sh
open build/CarbonTerminal.app
```

---

## IPC Channels

| Channel               | Direction         | Payload                          | Description                      |
|-----------------------|-------------------|----------------------------------|----------------------------------|
| `pty.spawn`           | Frontend → Native | `{ id: string }`                 | Spawn a new PTY session          |
| `pty.kill`            | Frontend → Native | `{ id: string }`                 | Terminate a PTY session          |
| `pty.<id>.in`         | Frontend → Native | Raw bytes                        | Keystrokes / stdin to the shell  |
| `pty.<id>.resize`     | Frontend → Native | `{ cols: number, rows: number }` | Notify shell of terminal resize  |
| `pty.<id>`            | Native → Frontend | Raw bytes                        | Shell output / stdout stream     |
| `clipboard.write`     | Frontend → Native | UTF-8 text                       | Write text to system clipboard   |
| `clipboard.read`      | Frontend → Native | _(empty)_                        | Read text from system clipboard  |

---

## Project Structure

```
carbon-terminal/
├── app/
│   └── frontend/          # React + TypeScript frontend (xterm.js)
├── deps/
│   └── wkwebview-ipc/     # Native IPC bridge library
├── resources/
│   ├── assets/            # App icon source
│   ├── Info.plist         # macOS bundle metadata
│   └── entitlements.plist # Codesign entitlements
├── ui/
│   └── mac/               # macOS native sources (AppDelegate, PtyManager, etc.)
├── utils/                 # Icon generation scripts
├── CMakeLists.txt
└── build.sh
```

---

## Contributing

Pull requests are welcome. For large changes please open an issue first to discuss
what you would like to change.

---

## License

MIT