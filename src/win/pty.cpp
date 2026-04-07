#include "../../include/win/pty.h"
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <nlohmann/json.hpp>
#include <logger/logger.h>
#include <atomic>
#include <memory>
#include <mutex>
#include <thread>
#include <unordered_map>
#include <vector>

namespace {

struct PtySession {
    HPCON             hpc         = nullptr;
    HANDLE            hProcess    = INVALID_HANDLE_VALUE;
    HANDLE            hProcThread = INVALID_HANDLE_VALUE;
    HANDLE            hIn         = INVALID_HANDLE_VALUE;
    HANDLE            hOut        = INVALID_HANDLE_VALUE;
    std::thread       reader;
    std::atomic<bool> alive{true};

    ~PtySession() {
        alive = false;
        if (hOut        != INVALID_HANDLE_VALUE) CloseHandle(hOut);
        if (hIn         != INVALID_HANDLE_VALUE) CloseHandle(hIn);
        if (hpc)                                 ClosePseudoConsole(hpc);
        if (hProcess    != INVALID_HANDLE_VALUE) CloseHandle(hProcess);
        if (hProcThread != INVALID_HANDLE_VALUE) CloseHandle(hProcThread);
    }
};

std::unordered_map<std::string, std::shared_ptr<PtySession>> g_sessions;
std::mutex g_mutex;

} // namespace

namespace ct::win {

void register_pty_handlers(IPC& ipc) {
    using json = nlohmann::json;

    // Capture ipc as a raw pointer — stable for the lifetime of main().
    // Do NOT capture by reference (&ipc): the handler closure is copied
    // internally by ct::IPC before being invoked, so a reference-capture
    // would dangle the moment that temporary copy is destroyed.
    IPC* ipc_ptr = &ipc;

    // ── pty.spawn ─────────────────────────────────────────────────────────────
    ipc.on("pty.spawn", [ipc_ptr](Packet pkt) {
        const std::string sid = pkt.session_id;
        if (sid.empty()) {
            logger::Warn("[pty] spawn: empty session_id, ignoring");
            return;
        }

        logger::Info("[pty] spawn requested (sid={})", sid);

        int cols = 80, rows = 24;
        if (!pkt.payload.empty()) {
            try {
                auto j = json::parse(pkt.payload.begin(), pkt.payload.end());
                cols   = j.value("cols", 80);
                rows   = j.value("rows", 24);
            } catch (const std::exception& e) {
                logger::Warn("[pty] spawn: JSON parse failed ({}), using defaults", e.what());
            }
        }

        logger::Info("[pty] spawn: cols={} rows={}", cols, rows);

        HANDLE hPipeInRead   = INVALID_HANDLE_VALUE;
        HANDLE hPipeInWrite  = INVALID_HANDLE_VALUE;
        HANDLE hPipeOutRead  = INVALID_HANDLE_VALUE;
        HANDLE hPipeOutWrite = INVALID_HANDLE_VALUE;

        if (!CreatePipe(&hPipeInRead,  &hPipeInWrite,  nullptr, 0) ||
            !CreatePipe(&hPipeOutRead, &hPipeOutWrite, nullptr, 0))
        {
            logger::Error("[pty] CreatePipe failed, GLE={}", GetLastError());
            ipc_ptr->send_text("pty.error", sid, "pipe creation failed");
            return;
        }

        COORD   size{ static_cast<SHORT>(cols), static_cast<SHORT>(rows) };
        HPCON   hpc = nullptr;
        HRESULT hr  = CreatePseudoConsole(size, hPipeInRead, hPipeOutWrite, 0, &hpc);

        CloseHandle(hPipeInRead);
        CloseHandle(hPipeOutWrite);

        if (FAILED(hr)) {
            logger::Error("[pty] CreatePseudoConsole failed, hr=0x{:08X}", static_cast<unsigned long>(hr));
            ipc_ptr->send_text("pty.error", sid, "pseudoconsole creation failed");
            CloseHandle(hPipeInWrite);
            CloseHandle(hPipeOutRead);
            return;
        }

        logger::Info("[pty] pseudoconsole created");

        SIZE_T attrSize = 0;
        InitializeProcThreadAttributeList(nullptr, 1, 0, &attrSize);
        std::vector<uint8_t> attrBuf(attrSize);
        auto* attrList = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(attrBuf.data());
        InitializeProcThreadAttributeList(attrList, 1, 0, &attrSize);
        UpdateProcThreadAttribute(attrList, 0,
            PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
            hpc, sizeof(hpc), nullptr, nullptr);

        STARTUPINFOEXW si{};
        si.StartupInfo.cb  = sizeof(si);
        si.lpAttributeList = attrList;

        wchar_t sysRoot[MAX_PATH]{};
        GetEnvironmentVariableW(L"SystemRoot", sysRoot, MAX_PATH);

        wchar_t ps5Path[MAX_PATH]{};
        swprintf_s(ps5Path, L"%s\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", sysRoot);

        wchar_t cmdBuf[MAX_PATH]{};
        wcsncpy_s(cmdBuf, ps5Path, _TRUNCATE);

        PROCESS_INFORMATION pi{};
        if (!CreateProcessW(nullptr, cmdBuf,
                            nullptr, nullptr, FALSE,
                            EXTENDED_STARTUPINFO_PRESENT,
                            nullptr, nullptr,
                            &si.StartupInfo, &pi))
        {
            logger::Error("[pty] CreateProcessW(powershell.exe) failed, GLE={}", GetLastError());
            ipc_ptr->send_text("pty.error", sid, "shell launch failed");
            DeleteProcThreadAttributeList(attrList);
            ClosePseudoConsole(hpc);
            CloseHandle(hPipeInWrite);
            CloseHandle(hPipeOutRead);
            return;
        }

        logger::Info("[pty] launched powershell.exe (sid={})", sid);
        DeleteProcThreadAttributeList(attrList);

        auto sess         = std::make_shared<PtySession>();
        sess->hpc         = hpc;
        sess->hProcess    = pi.hProcess;
        sess->hProcThread = pi.hThread;
        sess->hIn         = hPipeInWrite;
        sess->hOut        = hPipeOutRead;

        {
            std::lock_guard lock(g_mutex);
            g_sessions.emplace(sid, sess);
        }

        // Notify the frontend that the session is ready before starting the
        // reader thread.  The frontend uses this to mount the terminal and
        // begin routing pty.out frames; without it every subsequent frame
        // is dropped because no xterm instance exists yet.
        ipc_ptr->send_text("pty.spawned", sid, "");
        logger::Info("[pty] sent pty.spawned (sid={})", sid);

        // Capture ipc_ptr by value (it is just a pointer) so the thread
        // never holds a reference into any closure that may be destroyed.
        sess->reader = std::thread([ipc_ptr, sid, sess]() {
            logger::Info("[pty] reader thread started (sid={})", sid);
            uint8_t buf[4096];
            DWORD   n = 0;
            while (sess->alive &&
                   ReadFile(sess->hOut, buf, sizeof(buf), &n, nullptr) && n > 0)
            {
                std::string preview(n, '\0');
                for (DWORD i = 0; i < n; ++i)
                    preview[i] = (buf[i] >= 0x20 && buf[i] < 0x7F)
                                     ? static_cast<char>(buf[i])
                                     : '.';
                logger::Debug("[pty] read {} bytes → pty.out (sid={})  content: |{}|",
                              n, sid, preview);

                ipc_ptr->send_binary("pty.out", sid,
                                     std::span<const uint8_t>(buf, static_cast<size_t>(n)));
            }
            logger::Info("[pty] reader thread exiting (sid={}), GLE={}", sid, GetLastError());
            {
                std::lock_guard lock(g_mutex);
                g_sessions.erase(sid);
            }
            ipc_ptr->send_text("pty.exit", sid, "0");
        });
        sess->reader.detach();
    });

    // ── pty.in ────────────────────────────────────────────────────────────────
    ipc.on("pty.in", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        std::lock_guard lock(g_mutex);
        auto it = g_sessions.find(pkt.session_id);
        if (it == g_sessions.end()) {
            logger::Warn("[pty] pty.in: unknown sid={}", pkt.session_id);
            return;
        }
        DWORD written = 0;
        BOOL  ok = WriteFile(it->second->hIn,
                             pkt.payload.data(),
                             static_cast<DWORD>(pkt.payload.size()),
                             &written, nullptr);
        if (!ok)
            logger::Error("[pty] WriteFile failed, GLE={}", GetLastError());
    });

    // ── pty.resize ────────────────────────────────────────────────────────────
    ipc.on("pty.resize", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        int cols = 80, rows = 24;
        try {
            auto j = nlohmann::json::parse(pkt.payload.begin(), pkt.payload.end());
            cols   = j.value("cols", 80);
            rows   = j.value("rows", 24);
        } catch (const std::exception& e) {
            logger::Warn("[pty] resize: JSON parse failed ({})", e.what());
            return;
        }

        std::lock_guard lock(g_mutex);
        auto it = g_sessions.find(pkt.session_id);
        if (it == g_sessions.end()) {
            logger::Warn("[pty] resize: unknown sid={}", pkt.session_id);
            return;
        }
        COORD size{ static_cast<SHORT>(cols), static_cast<SHORT>(rows) };
        HRESULT hr = ResizePseudoConsole(it->second->hpc, size);
        if (FAILED(hr))
            logger::Error("[pty] ResizePseudoConsole failed, hr=0x{:08X}", static_cast<unsigned long>(hr));
        else
            logger::Info("[pty] resized to {}x{} (sid={})", cols, rows, pkt.session_id);
    });

    // ── pty.kill ──────────────────────────────────────────────────────────────
    ipc.on("pty.kill", [](Packet pkt) {
        logger::Info("[pty] kill requested (sid={})", pkt.session_id);
        std::shared_ptr<PtySession> sess;
        {
            std::lock_guard lock(g_mutex);
            auto it = g_sessions.find(pkt.session_id);
            if (it == g_sessions.end()) {
                logger::Warn("[pty] kill: unknown sid={}", pkt.session_id);
                return;
            }
            sess = std::move(it->second);
            g_sessions.erase(it);
        }
        sess->alive = false;
        TerminateProcess(sess->hProcess, 0);
    });
}

} // namespace ct::win