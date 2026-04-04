#import <Cocoa/Cocoa.h>
#include "../../include/mac/clipboard.h"

namespace ct::mac {

void register_clipboard_handlers(IPC& ipc) {

    ipc.on("clipboard.write", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        NSString *text = [[NSString alloc]
            initWithBytes: pkt.payload.data()
                   length: pkt.payload.size()
                 encoding: NSUTF8StringEncoding];
        if (!text) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            [NSPasteboard.generalPasteboard clearContents];
            [NSPasteboard.generalPasteboard setString:text
                                              forType:NSPasteboardTypeString];
        });
    });

    ipc.on("clipboard.read", [&ipc](Packet) {
        // Pasteboard must be accessed on the main thread
        dispatch_async(dispatch_get_main_queue(), ^{
            NSString *text = [NSPasteboard.generalPasteboard
                              stringForType:NSPasteboardTypeString] ?: @"";
            ipc.send_text("clipboard.data", "",
                          std::string_view(text.UTF8String ?: ""));
        });
    });
}

} // namespace ct::mac