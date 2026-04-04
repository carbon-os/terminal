// ConPTY-based PTY — requires Windows 10 1903+ (build 18362)
#include "../../include/win/pty.h"
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <nlohmann/json.hpp>
#include <atomic>
#include <memory>
#include <mutex>
#include <thread>
#include <unordered_map>
#include <vector>
#include <cstdio>

namespace {

struct PtySession {
    HPCON             hpc      = nullptr;
    HANDLE            hProcess = INVALID_HANDLE_VALUE;
    HANDLE            hProcThread = INVALID_HANDLE_VALUE;
    HANDLE            hIn      = INVALID_HANDLE_VALUE; // write → pty stdin
    HANDLE            hOut     = INVALID_HANDLE_VALUE; // read  ← pty stdout
    std::thread       reader;
    std::atomic<bool> alive{true};

    ~PtySession() {
        alive = false;
        // Closing hOut unblocks the ReadFile in the reader thread
        if (hOut     != INVALID_HANDLE_VALUE) CloseHandle(hOut);
        if (hIn      != INVALID_HANDLE_VALUE) CloseHandle(hIn);
        if (hpc)                              ClosePseudoConsole(hpc);
        if (hProcess != INVALID_HANDLE_VALUE) CloseHandle(hProcess);
        if (hProcThread != INVALID_HANDLE_VALUE) CloseHandle(hProcThread);
    }
};

std::unordered_map<std::string, std::shared_ptr<PtySession>> g_sessions;
std::mutex g_mutex;

} // namespace

namespace ct::win {

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

        // Pipes: our side ↔ ConPTY side
        HANDLE hPipeInRead   = INVALID_HANDLE_VALUE; // ConPTY reads stdin from here
        HANDLE hPipeInWrite  = INVALID_HANDLE_VALUE; // we write keystrokes here
        HANDLE hPipeOutRead  = INVALID_HANDLE_VALUE; // we read output here
        HANDLE hPipeOutWrite = INVALID_HANDLE_VALUE; // ConPTY writes stdout here

        if (!CreatePipe(&hPipeInRead,  &hPipeInWrite,  nullptr, 0) ||
            !CreatePipe(&hPipeOutRead, &hPipeOutWrite, nullptr, 0))
        {
            std::puts("[pty] CreatePipe failed");
            return;
        }

        COORD size{ static_cast<SHORT>(cols), static_cast<SHORT>(rows) };
        HPCON hpc = nullptr;
        HRESULT hr = CreatePseudoConsole(size, hPipeInRead, hPipeOutWrite, 0, &hpc);

        // ConPTY now owns these ends; close our copies
        CloseHandle(hPipeInRead);
        CloseHandle(hPipeOutWrite);

        if (FAILED(hr)) {
            std::puts("[pty] CreatePseudoConsole failed");
            CloseHandle(hPipeInWrite);
            CloseHandle(hPipeOutRead);
            return;
        }

        // Build the process attribute list that attaches it to our ConPTY
        SIZE_T attrSize = 0;
        InitializeProcThreadAttributeList(nullptr, 1, 0, &attrSize);
        std::vector<uint8_t> attrBuf(attrSize);
        auto* attrList = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(attrBuf.data());
        InitializeProcThreadAttributeList(attrList, 1, 0, &attrSize);
        UpdateProcThreadAttribute(attrList, 0,
            PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
            hpc, sizeof(hpc), nullptr, nullptr);

        STARTUPINFOEXW si{};
        si.StartupInfo.cb = sizeof(si);
        si.lpAttributeList = attrList;

        // Prefer PowerShell 7 → PowerShell 5 → cmd.exe
        const wchar_t* const shells[] = {
            L"pwsh.exe",
            L"powershell.exe",
            L"cmd.exe",
        };
        wchar_t cmdBuf[MAX_PATH]{};
        PROCESS_INFORMATION pi{};
        bool launched = false;
        for (auto* sh : shells) {
            wcsncpy_s(cmdBuf, sh, _TRUNCATE);
            if (CreateProcessW(nullptr, cmdBuf,
                               nullptr, nullptr, FALSE,
                               EXTENDED_STARTUPINFO_PRESENT,
                               nullptr, nullptr,
                               &si.StartupInfo, &pi))
            { launched = true; break; }
        }
        DeleteProcThreadAttributeList(attrList);

        if (!launched) {
            std::puts("[pty] CreateProcess failed for all shells");
            ClosePseudoConsole(hpc);
            CloseHandle(hPipeInWrite);
            CloseHandle(hPipeOutRead);
            return;
        }

        auto sess          = std::make_shared<PtySession>();
        sess->hpc          = hpc;
        sess->hProcess     = pi.hProcess;
        sess->hProcThread  = pi.hThread;
        sess->hIn          = hPipeInWrite;
        sess->hOut         = hPipeOutRead;

        sess->reader = std::thread([&ipc, sid, sess]() {
            uint8_t buf[4096];
            DWORD   n = 0;
            while (sess->alive &&
                   ReadFile(sess->hOut, buf, sizeof(buf), &n, nullptr) && n > 0)
            {
                ipc.send_binary("pty.out", sid,
                                std::span<const uint8_t>(buf, static_cast<size_t>(n)));
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
        DWORD written = 0;
        WriteFile(it->second->hIn,
                  pkt.payload.data(), static_cast<DWORD>(pkt.payload.size()),
                  &written, nullptr);
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
        COORD size{ static_cast<SHORT>(cols), static_cast<SHORT>(rows) };
        ResizePseudoConsole(it->second->hpc, size);
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
        TerminateProcess(sess->hProcess, 0);
        // ~PtySession closes everything and unblocks the reader thread
    });
}

} // namespace ct::win