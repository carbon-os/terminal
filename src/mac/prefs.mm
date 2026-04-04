#import <Foundation/Foundation.h>
#include "../../include/mac/prefs.h"

static NSString* const kProfilesKey = @"ct.profiles";
static NSString* const kSettingsKey = @"ct.settings";

namespace ct::mac {

void register_prefs_handlers(IPC& ipc) {

    // ── profiles ──────────────────────────────────────────────────────────────
    ipc.on("prefs.profiles.load", [&ipc](Packet) {
        NSData *d = [NSUserDefaults.standardUserDefaults dataForKey:kProfilesKey]
                    ?: [@"[]" dataUsingEncoding:NSUTF8StringEncoding];
        ipc.send_text("prefs.profiles.data", "",
                      { static_cast<const char*>(d.bytes), d.length });
    });

    ipc.on("prefs.profiles.save", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        NSData *d = [NSData dataWithBytes:pkt.payload.data()
                                   length:pkt.payload.size()];
        [NSUserDefaults.standardUserDefaults setObject:d forKey:kProfilesKey];
    });

    // ── settings ──────────────────────────────────────────────────────────────
    ipc.on("prefs.settings.load", [&ipc](Packet) {
        NSData *d = [NSUserDefaults.standardUserDefaults dataForKey:kSettingsKey]
                    ?: [@"{}" dataUsingEncoding:NSUTF8StringEncoding];
        ipc.send_text("prefs.settings.data", "",
                      { static_cast<const char*>(d.bytes), d.length });
    });

    ipc.on("prefs.settings.save", [](Packet pkt) {
        if (pkt.payload.empty()) return;
        NSData *d = [NSData dataWithBytes:pkt.payload.data()
                                   length:pkt.payload.size()];
        [NSUserDefaults.standardUserDefaults setObject:d forKey:kSettingsKey];
    });
}

} // namespace ct::mac