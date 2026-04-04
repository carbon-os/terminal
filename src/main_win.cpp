#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <ui/webview.h>
#include "ipc.h"
#include "win/pty.h"
#include "win/prefs.h"
#include <cstdio>

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    ui::WebView wv({
        .title   = "Carbon Terminal",
        .width   = 1280,
        .height  = 800,
#if _DEBUG
        .debug   = true,
        .logging = true,
#endif
    });

    ct::IPC ipc(wv);

    ct::win::register_prefs_handlers(ipc);
    ct::win::register_pty_handlers(ipc);

    wv.on_ready([&wv]() {
#if _DEBUG
        wv.load_url("http://localhost:5173/");
#else
        // Installer drops the web bundle beside the exe under web\
        wchar_t exePath[MAX_PATH]{};
        GetModuleFileNameW(nullptr, exePath, MAX_PATH);
        std::filesystem::path webDir =
            std::filesystem::path(exePath).parent_path() / "web" / "index.html";
        wv.load_file(webDir.string());
#endif
    });

    wv.on_close([&wv]() -> bool {
        wv.terminate();
        return true;
    });

    wv.run();
    return 0;
}