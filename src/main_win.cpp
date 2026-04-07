#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <ui/webview.h>
#include "ipc.h"
#include "win/pty.h"
#include "win/prefs.h"
#include <logger/logger.h>

int main(int argc, char* argv[]) {

    logger::SetEnabled(false);

    ui::WebView wv({
        .title         = "Carbon Terminal",
        .width         = 1280,
        .height        = 800,
        .debug         = true,
        .logging       = false,
        .runtime_path  = "C:\\Users\\cloud\\Desktop\\ui\\webview2_runtime\\146.0.3856.97",
        .user_data_dir = "C:\\Users\\cloud\\Desktop\\terminal\\cache",
    });

    ct::IPC ipc(wv);

    ct::win::register_prefs_handlers(ipc);
    ct::win::register_pty_handlers(ipc);

    wv.on_ready([&wv]() {
        logger::Info("[app] webview ready");
        wv.load_file("C:\\Users\\cloud\\Desktop\\terminal\\app\\frontend\\dist\\index.html");
    });

    wv.on_close([&wv]() -> bool {
        logger::Info("[app] window closed – shutting down");
        wv.terminate();
        return true;
    });

    wv.run();
    return 0;
}