#import "MainWindowController.h"
#import "WebViewFactory.h"
#import <WebKit/WebKit.h>

@implementation MainWindowController

- (instancetype)init {
    NSWindowStyleMask style =
        NSWindowStyleMaskTitled         |
        NSWindowStyleMaskClosable       |
        NSWindowStyleMaskMiniaturizable |
        NSWindowStyleMaskResizable;

    NSWindow *win = [[NSWindow alloc]
        initWithContentRect:NSMakeRect(0, 0, 1280, 800)
                  styleMask:style
                    backing:NSBackingStoreBuffered
                      defer:NO];

    self = [super initWithWindow:win];
    if (self) [self buildWindow];
    return self;
}

- (void)buildWindow {
    NSWindow *win          = self.window;
    win.title              = @"Carbon Terminal";
    win.minSize            = NSMakeSize(640, 400);
    win.titlebarAppearsTransparent = YES;
    win.appearance         = [NSAppearance appearanceNamed:NSAppearanceNameAqua];
    [win center];

    WKWebView *wv = [WebViewFactory webViewForRoute:@"/"];
    wv.autoresizingMask   = NSViewWidthSizable | NSViewHeightSizable;
    wv.frame              = win.contentView.bounds;
    win.contentView       = wv;
}

@end