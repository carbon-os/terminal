package main

import (
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	gopty "github.com/aymanbagabas/go-pty"
	"github.com/carbon-os/arc"
	"github.com/carbon-os/arc/ipc"
	"github.com/carbon-os/arc/window"
)

// ── Logger ────────────────────────────────────────────────────────────────────

type Logger struct {
	enabled bool
	l       *log.Logger
}

func newLogger(enabled bool) *Logger {
	return &Logger{
		enabled: enabled,
		l:       log.New(os.Stderr, "", log.LstdFlags),
	}
}

func (lg *Logger) Enable()  { lg.enabled = true }
func (lg *Logger) Disable() { lg.enabled = false }

func (lg *Logger) Printf(format string, v ...any) {
	if lg.enabled {
		lg.l.Printf(format, v...)
	}
}

func (lg *Logger) Fatalf(format string, v ...any) {
	lg.l.Fatalf(format, v...)
}

var logger *Logger

// ── Frame protocol (mirrors frame.ts) ────────────────────────────────────────

const (
	magicHI    = 0xCA
	magicLO    = 0xFE
	frameVer   = 0x01
	headerLen  = 10
	flagBinary = 0x01
)

type packet struct {
	flags     byte
	channel   string
	sessionID string
	payload   []byte
}

func encodeFrame(p packet) []byte {
	ch  := []byte(p.channel)
	sid := []byte(p.sessionID)
	out := make([]byte, headerLen+len(ch)+len(sid)+len(p.payload))
	out[0] = magicHI
	out[1] = magicLO
	out[2] = frameVer
	out[3] = p.flags
	out[4] = byte(len(ch))
	out[5] = byte(len(sid))
	binary.LittleEndian.PutUint32(out[6:10], uint32(len(p.payload)))
	off := headerLen
	copy(out[off:], ch);  off += len(ch)
	copy(out[off:], sid); off += len(sid)
	copy(out[off:], p.payload)
	return out
}

func decodeFrame(buf []byte) (packet, error) {
	if len(buf) < headerLen {
		return packet{}, fmt.Errorf("frame too short (%d bytes)", len(buf))
	}
	if buf[0] != magicHI || buf[1] != magicLO {
		return packet{}, fmt.Errorf("bad magic 0x%02x 0x%02x", buf[0], buf[1])
	}
	if buf[2] != frameVer {
		return packet{}, fmt.Errorf("bad version %d (want %d)", buf[2], frameVer)
	}
	chanL := int(buf[4])
	sessL := int(buf[5])
	payL  := int(binary.LittleEndian.Uint32(buf[6:10]))
	need  := headerLen + chanL + sessL + payL
	if len(buf) < need {
		return packet{}, fmt.Errorf("frame truncated (have %d, need %d)", len(buf), need)
	}
	off := headerLen
	ch  := string(buf[off : off+chanL]); off += chanL
	sid := string(buf[off : off+sessL]); off += sessL
	pay := make([]byte, payL)
	copy(pay, buf[off:off+payL])
	return packet{flags: buf[3], channel: ch, sessionID: sid, payload: pay}, nil
}

// ── PTY session ───────────────────────────────────────────────────────────────

type ptySession struct {
	pty gopty.Pty
	cmd *gopty.Cmd
	// no extra mutex needed — conPty already has its own internal RWMutex
}

// resize calls the library with (width=cols, height=rows) which is the
// correct parameter order for both conPty (Windows) and unixPty.
func (s *ptySession) resize(cols, rows int) error {
	return s.pty.Resize(cols, rows)
}

// ── Terminal server ───────────────────────────────────────────────────────────

type termServer struct {
	mu       sync.Mutex
	sessions map[string]*ptySession
	ipcMain  *ipc.IPC
}

func (s *termServer) send(channel, sessionID string, payload []byte, binary bool) {
	flags := byte(0)
	if binary {
		flags = flagBinary
	}
	if payload == nil {
		payload = []byte{}
	}
	frame := encodeFrame(packet{
		flags:     flags,
		channel:   channel,
		sessionID: sessionID,
		payload:   payload,
	})
	s.ipcMain.SendBytes("__ct_frame", frame)
}

func (s *termServer) sendJSON(channel, sessionID string, v any) {
	b, _ := json.Marshal(v)
	s.send(channel, sessionID, b, false)
}

// ── Frame router ──────────────────────────────────────────────────────────────

func (s *termServer) handleFrame(msg ipc.Message) {
	pkt, err := decodeFrame(msg.Bytes())
	if err != nil {
		logger.Printf("[ct] decode error: %v", err)
		return
	}
	logger.Printf("[ct] recv  channel=%q sid=%q payload=%d bytes", pkt.channel, pkt.sessionID, len(pkt.payload))

	switch pkt.channel {
	case "pty.spawn":
		s.spawnSession(pkt)
	case "pty.in":
		s.writeToSession(pkt)
	case "pty.resize":
		s.resizeSession(pkt)
	case "pty.kill":
		s.killSession(pkt)
	case "prefs.profiles.load":
		s.loadPrefs("profiles", pkt.sessionID)
	case "prefs.profiles.save":
		s.savePrefs("profiles", pkt)
	case "prefs.settings.load":
		s.loadPrefs("settings", pkt.sessionID)
	case "prefs.settings.save":
		s.savePrefs("settings", pkt)
	default:
		logger.Printf("[ct] unknown channel %q", pkt.channel)
	}
}

// ── PTY handlers ──────────────────────────────────────────────────────────────

type spawnMsg struct {
	Cols  uint16 `json:"cols"`
	Rows  uint16 `json:"rows"`
	Shell string `json:"shell"`
}

func resolveShell(requested string) string {
	if runtime.GOOS == "windows" {
		switch requested {
		case "powershell":
			if _, err := exec.LookPath("pwsh.exe"); err == nil {
				return "pwsh.exe"
			}
			return "powershell.exe"
		case "cmd":
			return "cmd.exe"
		case "wsl2":
			return "wsl.exe"
		}
		// fallback
		if _, err := exec.LookPath("pwsh.exe"); err == nil {
			return "pwsh.exe"
		}
		return "powershell.exe"
	}
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}
	return "/bin/bash"
}

func (s *termServer) spawnSession(pkt packet) {
	var msg spawnMsg
	if err := json.Unmarshal(pkt.payload, &msg); err != nil {
		logger.Printf("[ct] pty.spawn: bad JSON: %v", err)
		return
	}

	shell := resolveShell(msg.Shell)

	pt, err := gopty.New()
	if err != nil {
		logger.Printf("[ct] pty.spawn: create pty failed: %v", err)
		return
	}

	cmd := pt.Command(shell)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	// Start the process before resizing — ConPTY on Windows requires the
	// process to exist before ResizePseudoConsole takes effect.
	if err := cmd.Start(); err != nil {
		pt.Close()
		logger.Printf("[ct] pty.spawn: start failed: %v", err)
		return
	}

	sess := &ptySession{pty: pt, cmd: cmd}

	s.mu.Lock()
	s.sessions[pkt.sessionID] = sess
	s.mu.Unlock()

	cols, rows := int(msg.Cols), int(msg.Rows)
	if cols < 1 { cols = 80 }
	if rows < 1 { rows = 24 }

	// Resize after Start in a goroutine. On Windows we pause briefly to let
	// the pseudoconsole finish wiring up before the first resize call.
	go func() {
		if runtime.GOOS == "windows" {
			time.Sleep(30 * time.Millisecond)
		}
		if err := sess.resize(cols, rows); err != nil {
			logger.Printf("[ct] pty.spawn: initial resize failed: %v", err)
		}
	}()

	sid := pkt.sessionID
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := pt.Read(buf)
			if n > 0 {
				out := make([]byte, n)
				copy(out, buf[:n])
				s.send("pty.out", sid, out, true)
			}
			if err != nil {
				break
			}
		}
		cmd.Wait()
		pt.Close()

		s.mu.Lock()
		delete(s.sessions, sid)
		s.mu.Unlock()

		s.send("pty.exit", sid, []byte{}, false)
		logger.Printf("[ct] session %q exited", sid)
	}()

	logger.Printf("[ct] spawned session %q shell=%s cols=%d rows=%d", sid, shell, cols, rows)
}

func (s *termServer) writeToSession(pkt packet) {
	s.mu.Lock()
	sess, ok := s.sessions[pkt.sessionID]
	s.mu.Unlock()
	if !ok {
		logger.Printf("[ct] pty.in: no session %q", pkt.sessionID)
		return
	}
	if _, err := sess.pty.Write(pkt.payload); err != nil {
		logger.Printf("[ct] pty.in: write: %v", err)
	}
}

type resizeMsg struct {
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

func (s *termServer) resizeSession(pkt packet) {
	var msg resizeMsg
	if err := json.Unmarshal(pkt.payload, &msg); err != nil {
		logger.Printf("[ct] pty.resize: bad JSON: %v", err)
		return
	}

	cols, rows := int(msg.Cols), int(msg.Rows)
	if cols < 1 || rows < 1 {
		logger.Printf("[ct] pty.resize: ignoring zero dimensions cols=%d rows=%d", cols, rows)
		return
	}

	s.mu.Lock()
	sess, ok := s.sessions[pkt.sessionID]
	s.mu.Unlock()
	if !ok {
		return
	}

	// Resize(width=cols, height=rows) — matches the library's parameter order
	if err := sess.resize(cols, rows); err != nil {
		logger.Printf("[ct] pty.resize: %v", err)
	}
}

func (s *termServer) killSession(pkt packet) {
	s.mu.Lock()
	sess, ok := s.sessions[pkt.sessionID]
	if ok {
		delete(s.sessions, pkt.sessionID)
	}
	s.mu.Unlock()
	if !ok {
		return
	}
	sess.pty.Close()
	logger.Printf("[ct] killed session %q", pkt.sessionID)
}

// ── Preferences ───────────────────────────────────────────────────────────────

func prefsPath(name string) (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	base := filepath.Join(dir, "carbon-terminal")
	if err := os.MkdirAll(base, 0755); err != nil {
		return "", err
	}
	return filepath.Join(base, name+".json"), nil
}

func (s *termServer) loadPrefs(name, sessionID string) {
	responseCh := "prefs." + name + ".data"

	path, err := prefsPath(name)
	if err != nil {
		logger.Printf("[ct] prefs.load %s: %v", name, err)
		s.send(responseCh, sessionID, []byte("{}"), false)
		return
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if !os.IsNotExist(err) {
			logger.Printf("[ct] prefs.load %s: read error: %v", name, err)
		}
		s.send(responseCh, sessionID, []byte("{}"), false)
		return
	}

	s.send(responseCh, sessionID, data, false)
	logger.Printf("[ct] prefs loaded %s (%d bytes)", name, len(data))
}

func (s *termServer) savePrefs(name string, pkt packet) {
	path, err := prefsPath(name)
	if err != nil {
		logger.Printf("[ct] prefs.save %s: %v", name, err)
		return
	}
	if err := os.WriteFile(path, pkt.payload, 0644); err != nil {
		logger.Printf("[ct] prefs.save %s: write: %v", name, err)
		return
	}
	logger.Printf("[ct] prefs saved %s (%d bytes)", name, len(pkt.payload))
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	verbose := flag.Bool("log", false, "enable debug logging")
	flag.Parse()

	if os.Getenv("CT_LOG") != "" {
		*verbose = true
	}

	logger = newLogger(*verbose)

	app := arc.NewApp(arc.AppConfig{
		Title:    "Carbon Terminal",
		Logging:  false,
		Renderer: arc.RendererConfig{Path: "/Users/galaxy/Desktop/arc/libarc/build/bin/arc-host"},
	})

	app.OnReady(func() {
		win := app.NewBrowserWindow(window.Config{
			Title:  "Carbon Terminal",
			Width:  1000,
			Height: 700,
			Debug:  false,
			TitleBarStyle: window.TitleBarHidden,
		})

		srv := &termServer{
			sessions: make(map[string]*ptySession),
			ipcMain:  win.IPC(),
		}

		ipcMain := win.IPC()
		ipcMain.On("__ct_frame", srv.handleFrame)

		win.OnReady(func() {
			win.LoadFile("frontend/dist/index.html")
		})
	})

	app.OnClose(func() bool { return true })

	if err := app.Run(); err != nil {
		logger.Fatalf("arc: %v", err)
	}
}