#import "WebViewFactory.h"
#import "TerminalWebView.h"
#import "PtyManager.h"
#import "PreferencesManager.h"
#import <wkwebview-ipc/IPC.h>

@implementation WebViewFactory

+ (void)load {
    // ── Clipboard ─────────────────────────────────────────────────────────────
    [IPC on:@"clipboard.write" handler:^(NSData *data) {
        NSString *text = [[NSString alloc] initWithData:data
                                               encoding:NSUTF8StringEncoding];
        if (!text) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            NSPasteboard *pb = NSPasteboard.generalPasteboard;
            [pb clearContents];
            [pb setString:text forType:NSPasteboardTypeString];
        });
    }];

    [IPC onRequest:@"clipboard.read" handler:^NSData * _Nullable(NSData * _Nullable _) {
        NSString *text =
            [NSPasteboard.generalPasteboard stringForType:NSPasteboardTypeString] ?: @"";
        return [text dataUsingEncoding:NSUTF8StringEncoding];
    }];

    // ── PTY ───────────────────────────────────────────────────────────────────
    [IPC on:@"pty.spawn" handler:^(NSData *data) {
        NSDictionary *json =
            [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        NSString *sessionID = json[@"id"];
        if (sessionID) [[PtyManager shared] spawnWithID:sessionID];
    }];

    [IPC on:@"pty.kill" handler:^(NSData *data) {
        NSDictionary *json =
            [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        NSString *sessionID = json[@"id"];
        if (sessionID) [[PtyManager shared] killSession:sessionID];
    }];

    // ── Preferences: Profiles ─────────────────────────────────────────────────
    // JS  →  native: "give me the saved profiles"
    // native  →  JS: responds on prefs.profiles.data (always responds,
    //            sends "[]" on first launch so JS knows load is complete)
    [IPC on:@"prefs.profiles.load" handler:^(NSData * _Nullable __unused _) {
        NSData *stored = [[PreferencesManager shared] loadProfiles]
                         ?: [@"[]" dataUsingEncoding:NSUTF8StringEncoding];
        [IPC send:@"prefs.profiles.data" data:stored];
    }];

    [IPC on:@"prefs.profiles.save" handler:^(NSData *data) {
        if (data.length) [[PreferencesManager shared] saveProfiles:data];
    }];

    // ── Preferences: Settings ─────────────────────────────────────────────────
    // Same pattern – native sends "{}" on first launch.
    [IPC on:@"prefs.settings.load" handler:^(NSData * _Nullable __unused _) {
        NSData *stored = [[PreferencesManager shared] loadSettings]
                         ?: [@"{}" dataUsingEncoding:NSUTF8StringEncoding];
        [IPC send:@"prefs.settings.data" data:stored];
    }];

    [IPC on:@"prefs.settings.save" handler:^(NSData *data) {
        if (data.length) [[PreferencesManager shared] saveSettings:data];
    }];
}

+ (WKWebViewConfiguration *)baseConfiguration {
    WKWebViewConfiguration *cfg = [[WKWebViewConfiguration alloc] init];
    [cfg setURLSchemeHandler:[IPC schemeHandler] forURLScheme:@"ipc"];
    return cfg;
}

+ (WKWebView *)webViewForRoute:(NSString *)route {
    WKWebViewConfiguration *cfg = [self baseConfiguration];
    TerminalWebView *wv = [[TerminalWebView alloc] initWithFrame:NSZeroRect
                                                   configuration:cfg];
    [IPC attachToWebView:wv];
    [wv loadRequest:[NSURLRequest requestWithURL:[self urlForRoute:route]]];
    return wv;
}

+ (NSURL *)urlForRoute:(NSString *)route {
#if DEBUG
    NSString *base = @"http://localhost:5173";
#else
    NSString *base = @"ipc://app";
#endif
    return [NSURL URLWithString:[base stringByAppendingString:route]];
}

@end