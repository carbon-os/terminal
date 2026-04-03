#pragma once
#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface WebViewFactory : NSObject
+ (WKWebViewConfiguration *)baseConfiguration;
+ (WKWebView *)webViewForRoute:(NSString *)route;
+ (NSURL *)urlForRoute:(NSString *)route;
@end