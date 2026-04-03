#pragma once
#import <Cocoa/Cocoa.h>
@class MainWindowController;

@interface AppDelegate : NSObject <NSApplicationDelegate>
@property (nonatomic, strong) MainWindowController *windowController;
@end