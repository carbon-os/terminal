#pragma once
#import <WebKit/WebKit.h>

@interface TerminalWebView : WKWebView <WKScriptMessageHandler>
@end