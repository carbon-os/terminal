#import "TerminalWebView.h"
#import <wkwebview-ipc/IPC.h>

@implementation TerminalWebView

- (instancetype)initWithFrame:(NSRect)frame
                configuration:(WKWebViewConfiguration *)config {
    self = [super initWithFrame:frame configuration:config];
    return self;
}

- (void)userContentController:(WKUserContentController *)ucc
      didReceiveScriptMessage:(WKScriptMessage *)message {
    // Route any custom script messages here as features are added
}

@end