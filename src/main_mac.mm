// macOS entry – Obj-C++ so NSBundle path resolution is trivial
#import <Cocoa/Cocoa.h>
#include <ui/webview.h>
#include "ipc.h"
#include "mac/pty.h"
#include "mac/prefs.h"
#include "mac/clipboard.h"
#include <cstdio>

int main(int, const char**) {
    @autoreleasepool {

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

        ct::mac::register_clipboard_handlers(ipc);
        ct::mac::register_prefs_handlers(ipc);
        ct::mac::register_pty_handlers(ipc);

        wv.on_ready([&wv]() {
#if DEBUG
            wv.load_url("http://localhost:5173/");
#else
            // Resolve Resources/web/index.html inside the .app bundle
            NSURL *web = [NSBundle.mainBundle URLForResource:@"web/index"
                                              withExtension:@"html"];
            if (web) wv.load_file(web.path.UTF8String);
            else     std::puts("[app] ERROR: could not find web bundle");
#endif
        });

        wv.on_close([&wv]() -> bool {
            std::puts("[app] window closed – shutting down");
            wv.terminate();
            return true;
        });

        wv.run();
    }
    return 0;
}