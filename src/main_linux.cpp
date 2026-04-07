#include <ui/webview.h>
#include "ipc.h"
#include "linux/pty.h"
#include "linux/prefs.h"
#include <logger/logger.h>

int main() {
#if DEBUG
    logger::SetEnabled(true);
#endif

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
        wv.load_file("/home/user/terminal/app/frontend/dist/index.html");
    });

    wv.on_close([&wv]() -> bool {
        logger::Info("[app] window closed – shutting down");
        wv.terminate();
        return true;
    });

    wv.run();
    return 0;
}