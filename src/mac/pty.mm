#import <Foundation/Foundation.h>
#include <util.h>       // forkpty
#include <termios.h>
#include <sys/ioctl.h>
#include "../../include/mac/pty.h"
#include <nlohmann/json.hpp>
#include <mutex>
#include <string>
#include <unordered_map>

// ── Per-session state ─────────────────────────────────────────────────────────

namespace {

struct PtySession {
    pid_t             pid      = -1;
    int               masterFd = -1;
    dispatch_source_t readSrc  = nil;
};

std::unordered_map<std::string, PtySession> g_sessions;
std::mutex                                  g_mutex;

} // namespace

// ── Handler registration ──────────────────────────────────────────────────────

namespace ct::mac {

void register_pty_handlers(IPC& ipc) {
    using json = nlohmann::json;

    // ── pty.spawn ─────────────────────────────────────────────────────────────
    // Packet: session_id = new session UUID
    //         payload    = optional JSON { "cols": N, "rows": N }
    ipc.on("pty.spawn", [&ipc](Packet pkt) {
        const std::string sid = pkt.session_id;
        if (sid.empty()) return;

        int cols = 80, rows = 24;
        if (!pkt.payload.empty()) {
            try {
                auto j = json::parse(pkt.text());
                cols   = j.value("cols", 80);
                rows   = j.value("rows", 24);
            } catch (...) {}
        }

        struct winsize ws { .ws_row = (unsigned short)rows,
                            .ws_col = (unsigned short)cols };
        int   masterFd = -1;
        pid_t pid      = ::forkpty(&masterFd, nullptr, nullptr, &ws);

        if (pid < 0) { std::perror("[pty] forkpty"); return; }

        if (pid == 0) {
            const char *shell = ::getenv("SHELL") ?: "/bin/zsh";
            ::setenv("TERM",         "xterm-256color", 1);
            ::setenv("TERM_PROGRAM", "CarbonTerminal",  1);
            ::execl(shell, shell, "-l", nullptr);
            ::_exit(1);
        }

        // ── parent ────────────────────────────────────────────────────────────
        auto q   = dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0);
        auto src = dispatch_source_create(DISPATCH_SOURCE_TYPE_READ,
                                          (uintptr_t)masterFd, 0, q);

        // Stream output to JS on "pty.out"
        dispatch_source_set_event_handler(src, ^{
            uint8_t buf[4096];
            ssize_t n = ::read(masterFd, buf, sizeof(buf));
            if (n > 0) {
                ipc.send_binary("pty.out", sid,
                                std::span<const uint8_t>(buf, (size_t)n));
            } else {
                dispatch_source_cancel(src);
            }
        });

        dispatch_source_set_cancel_handler(src, ^{
            ::close(masterFd);
            std::lock_guard lock(g_mutex);
            g_sessions.erase(sid);
            // notify JS the session is gone
            ipc.send_text("pty.exit", sid, "0");
        });

        {
            std::lock_guard lock(g_mutex);
            g_sessions.emplace(sid, PtySession{ pid, masterFd, src });
        }

        dispatch_resume(src);
    });

    // ── pty.in ────────────────────────────────────────────────────────────────
    // Packet: session_id = target session, payload = raw keystroke bytes
    ipc.on("pty.in", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        std::lock_guard lock(g_mutex);
        auto it = g_sessions.find(pkt.session_id);
        if (it == g_sessions.end()) return;
        ::write(it->second.masterFd, pkt.payload.data(), pkt.payload.size());
    });

    // ── pty.resize ────────────────────────────────────────────────────────────
    // Packet: session_id = target session, payload = JSON { "cols": N, "rows": N }
    ipc.on("pty.resize", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        int cols = 80, rows = 24;
        try {
            auto j = json::parse(pkt.text());
            cols   = j.value("cols", 80);
            rows   = j.value("rows", 24);
        } catch (...) { return; }

        std::lock_guard lock(g_mutex);
        auto it = g_sessions.find(pkt.session_id);
        if (it == g_sessions.end()) return;

        struct winsize ws { .ws_row = (unsigned short)rows,
                            .ws_col = (unsigned short)cols };
        ::ioctl(it->second.masterFd, TIOCSWINSZ, &ws);
    });

    // ── pty.kill ──────────────────────────────────────────────────────────────
    // Packet: session_id = target session, no payload needed
    ipc.on("pty.kill", [](Packet pkt) {
        std::lock_guard lock(g_mutex);
        auto it = g_sessions.find(pkt.session_id);
        if (it == g_sessions.end()) return;
        dispatch_source_cancel(it->second.readSrc);
        ::kill(it->second.pid, SIGHUP);
        // erase happens in cancel handler
    });
}

} // namespace ct::mac