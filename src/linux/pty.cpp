#include "../../include/linux/pty.h"
#include <pty.h>        // forkpty  (-lutil)
#include <termios.h>
#include <sys/ioctl.h>
#include <unistd.h>
#include <signal.h>
#include <nlohmann/json.hpp>
#include <atomic>
#include <memory>
#include <mutex>
#include <thread>
#include <unordered_map>

namespace {

struct PtySession {
    pid_t             pid      = -1;
    int               masterFd = -1;
    std::thread       reader;
    std::atomic<bool> alive{true};

    ~PtySession() {
        alive = false;
        if (masterFd >= 0) ::close(masterFd);
    }
};

std::unordered_map<std::string, std::shared_ptr<PtySession>> g_sessions;
std::mutex g_mutex;

} // namespace

namespace ct::linux_ {

void register_pty_handlers(IPC& ipc) {
    using json = nlohmann::json;

    // ── pty.spawn ─────────────────────────────────────────────────────────────
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

        struct winsize ws{};
        ws.ws_col = static_cast<unsigned short>(cols);
        ws.ws_row = static_cast<unsigned short>(rows);

        int   masterFd = -1;
        pid_t pid      = ::forkpty(&masterFd, nullptr, nullptr, &ws);
        if (pid < 0) { std::perror("[pty] forkpty"); return; }

        if (pid == 0) {
            const char* shell = ::getenv("SHELL") ?: "/bin/bash";
            ::setenv("TERM",         "xterm-256color", 1);
            ::setenv("TERM_PROGRAM", "CarbonTerminal",  1);
            ::execl(shell, shell, "-l", nullptr);
            ::_exit(1);
        }

        auto sess      = std::make_shared<PtySession>();
        sess->pid      = pid;
        sess->masterFd = masterFd;

        // Reader thread — streams pty output to JS on "pty.out"
        sess->reader = std::thread([&ipc, sid, sess]() {
            uint8_t buf[4096];
            while (sess->alive) {
                ssize_t n = ::read(sess->masterFd, buf, sizeof(buf));
                if (n > 0) {
                    ipc.send_binary("pty.out", sid,
                                    std::span<const uint8_t>(buf, static_cast<size_t>(n)));
                } else {
                    break;  // EOF or error → shell exited
                }
            }
            {
                std::lock_guard lock(g_mutex);
                g_sessions.erase(sid);
            }
            ipc.send_text("pty.exit", sid, "0");
        });
        sess->reader.detach();

        std::lock_guard lock(g_mutex);
        g_sessions.emplace(sid, std::move(sess));
    });

    // ── pty.in ────────────────────────────────────────────────────────────────
    ipc.on("pty.in", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        std::lock_guard lock(g_mutex);
        auto it = g_sessions.find(pkt.session_id);
        if (it == g_sessions.end()) return;
        ::write(it->second->masterFd, pkt.payload.data(), pkt.payload.size());
    });

    // ── pty.resize ────────────────────────────────────────────────────────────
    ipc.on("pty.resize", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        int cols = 80, rows = 24;
        try {
            auto j = nlohmann::json::parse(pkt.text());
            cols   = j.value("cols", 80);
            rows   = j.value("rows", 24);
        } catch (...) { return; }

        std::lock_guard lock(g_mutex);
        auto it = g_sessions.find(pkt.session_id);
        if (it == g_sessions.end()) return;
        struct winsize ws{};
        ws.ws_col = static_cast<unsigned short>(cols);
        ws.ws_row = static_cast<unsigned short>(rows);
        ::ioctl(it->second->masterFd, TIOCSWINSZ, &ws);
    });

    // ── pty.kill ──────────────────────────────────────────────────────────────
    ipc.on("pty.kill", [](Packet pkt) {
        std::shared_ptr<PtySession> sess;
        {
            std::lock_guard lock(g_mutex);
            auto it = g_sessions.find(pkt.session_id);
            if (it == g_sessions.end()) return;
            sess = std::move(it->second);
            g_sessions.erase(it);
        }
        sess->alive = false;
        ::kill(sess->pid, SIGHUP);
        // masterFd closed by ~PtySession; reader thread will see EOF and exit
    });
}

} // namespace ct::linux_