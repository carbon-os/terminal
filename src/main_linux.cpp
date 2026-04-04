#include <ui/webview.h>
#include "ipc.h"
#include "linux/pty.h"
#include "linux/prefs.h"
#include <cstdio>

int main() {
    ui::WebView wv({
        .title   = "Carbon Terminal",
        .width   = 1280,
        .height  = 800,
#if DEBUG
        .debug   = true,
        .logging = true,
#endif
    });

    ct::IPC ipc(wv);

    ct::linux_::register_prefs_handlers(ipc);
    ct::linux_::register_pty_handlers(ipc);

    wv.on_ready([&wv]() {
#if DEBUG
        wv.load_url("http://localhost:5173/");
#else
        wv.load_file(CT_WEB_DIR "/index.html"); // set by CMake install rules
#endif
    });

    wv.on_close([&wv]() -> bool {
        std::puts("[app] window closed – shutting down");
        wv.terminate();
        return true;
    });

    wv.run();
    return 0;
}