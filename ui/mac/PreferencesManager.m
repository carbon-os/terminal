#import "PreferencesManager.h"

static NSString *const kProfilesKey = @"CarbonTerminal.profiles";
static NSString *const kSettingsKey = @"CarbonTerminal.settings";

@implementation PreferencesManager

+ (instancetype)shared {
    static PreferencesManager *instance;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ instance = [[PreferencesManager alloc] init]; });
    return instance;
}

// ── Profiles ──────────────────────────────────────────────────────────────────

- (NSData * _Nullable)loadProfiles {
    return [NSUserDefaults.standardUserDefaults dataForKey:kProfilesKey];
}

- (void)saveProfiles:(NSData *)jsonData {
    [NSUserDefaults.standardUserDefaults setObject:jsonData forKey:kProfilesKey];
    [NSUserDefaults.standardUserDefaults synchronize];
}

// ── Settings ──────────────────────────────────────────────────────────────────

- (NSData * _Nullable)loadSettings {
    return [NSUserDefaults.standardUserDefaults dataForKey:kSettingsKey];
}

- (void)saveSettings:(NSData *)jsonData {
    [NSUserDefaults.standardUserDefaults setObject:jsonData forKey:kSettingsKey];
    [NSUserDefaults.standardUserDefaults synchronize];
}

@end