#pragma once
#import <Foundation/Foundation.h>

@interface PtyManager : NSObject
+ (instancetype)shared;
- (void)spawnWithID:(NSString *)sessionID;
- (void)writeToSession:(NSString *)sessionID data:(NSData *)data;
- (void)resizeSession:(NSString *)sessionID cols:(int)cols rows:(int)rows;
- (void)killSession:(NSString *)sessionID;
@end