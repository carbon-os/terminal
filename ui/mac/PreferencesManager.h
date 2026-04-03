#pragma once
#import <Foundation/Foundation.h>

/// Thin wrapper around NSUserDefaults for persisting terminal profiles
/// and the last-used settings. All I/O is JSON-encoded NSData so the
/// IPC layer can pass it straight through without re-encoding.
@interface PreferencesManager : NSObject
+ (instancetype)shared;

// Profiles  ---------------------------------------------------------------
/// Returns the stored profiles JSON, or nil if nothing has been saved yet.
- (NSData * _Nullable)loadProfiles;
- (void)saveProfiles:(NSData *)jsonData;

// Settings  ---------------------------------------------------------------
/// Returns the stored settings JSON, or nil on first launch.
- (NSData * _Nullable)loadSettings;
- (void)saveSettings:(NSData *)jsonData;

@end