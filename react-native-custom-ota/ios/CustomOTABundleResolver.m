#import "CustomOTABundleResolver.h"

static BOOL hasCheckedRollbackInProcess = NO;

@implementation CustomOTABundleResolver

+ (nullable NSURL *)getOTADirectory {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *docDir = paths.firstObject;
    if (!docDir) return nil;
    return [NSURL fileURLWithPath:[docDir stringByAppendingPathComponent:@"ota"]];
}

+ (nullable NSURL *)stateURL {
    NSURL *otaDir = [self getOTADirectory];
    if (!otaDir) return nil;
    return [otaDir URLByAppendingPathComponent:@"state.json"];
}

+ (NSInteger)compareVersion:(NSString *)a withVersion:(NSString *)b {
    NSString *cleanA = [a stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    NSString *cleanB = [b stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if ([cleanA hasPrefix:@"v"] || [cleanA hasPrefix:@"V"]) cleanA = [cleanA substringFromIndex:1];
    if ([cleanB hasPrefix:@"v"] || [cleanB hasPrefix:@"V"]) cleanB = [cleanB substringFromIndex:1];

    NSArray *pa = [cleanA componentsSeparatedByString:@"."];
    NSArray *pb = [cleanB componentsSeparatedByString:@"."];
    NSInteger n = MAX(pa.count, pb.count);
    for (NSInteger i = 0; i < n; i++) {
        NSInteger x = i < pa.count ? [pa[i] integerValue] : 0;
        NSInteger y = i < pb.count ? [pb[i] integerValue] : 0;
        if (x > y) return 1;
        if (x < y) return -1;
    }
    return 0;
}

+ (void)checkAndCleanIfNativeUpdated {
    NSURL *stateURL = [self stateURL];
    if (!stateURL || ![[NSFileManager defaultManager] fileExistsAtPath:stateURL.path]) return;

    NSData *data = [NSData dataWithContentsOfURL:stateURL];
    if (!data) return;

    NSMutableDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:nil];
    if (!json || ![json isKindOfClass:[NSMutableDictionary class]]) return;

    NSString *savedNativeVersion = json[@"nativeVersion"] ?: @"";
    NSString *currentNativeVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"0.0.0";

    if (savedNativeVersion.length == 0 || [savedNativeVersion isEqualToString:@"0.0.0"] || [savedNativeVersion isEqualToString:@"1.0.0"]) {
        json[@"nativeVersion"] = currentNativeVersion;
        NSData *updatedData = [NSJSONSerialization dataWithJSONObject:json options:NSJSONWritingPrettyPrinted error:nil];
        [updatedData writeToURL:stateURL atomically:YES];
        return;
    }

    if ([self compareVersion:currentNativeVersion withVersion:savedNativeVersion] > 0) {
        NSURL *otaDir = [self getOTADirectory];
        if (otaDir) {
            NSString *currentDir = [otaDir.path stringByAppendingPathComponent:@"current"];
            NSString *backupDir = [otaDir.path stringByAppendingPathComponent:@"backup"];
            [[NSFileManager defaultManager] removeItemAtPath:currentDir error:nil];
            [[NSFileManager defaultManager] removeItemAtPath:backupDir error:nil];
        }
        [[NSFileManager defaultManager] removeItemAtPath:stateURL.path error:nil];
    }
}

+ (void)checkAndRollbackIfPending {
    NSURL *stateURL = [self stateURL];
    if (!stateURL || ![[NSFileManager defaultManager] fileExistsAtPath:stateURL.path]) return;

    NSData *data = [NSData dataWithContentsOfURL:stateURL];
    if (!data) return;

    NSMutableDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:nil];
    if (!json || ![json isKindOfClass:[NSMutableDictionary class]]) return;

    NSNumber *pending = json[@"pending"];
    if (![pending boolValue]) return;

    NSURL *otaDir = [self getOTADirectory];
    if (!otaDir) return;
    NSString *currentDir = [otaDir.path stringByAppendingPathComponent:@"current"];
    NSString *backupDir = [otaDir.path stringByAppendingPathComponent:@"backup"];

    BOOL trial = [json[@"trial"] boolValue];
    if (trial) {
        NSLog(@"[CustomOTA] Detected crash on pending release! Rolling back to backup...");
        [[NSFileManager defaultManager] removeItemAtPath:currentDir error:nil];
        if ([[NSFileManager defaultManager] fileExistsAtPath:backupDir]) {
            [[NSFileManager defaultManager] moveItemAtPath:backupDir toPath:currentDir error:nil];
        }

        NSString *failedVer = json[@"currentVersion"] ?: @"";
        NSMutableArray *failedVersions = [NSMutableArray arrayWithArray:json[@"failedVersions"] ?: @[]];
        if (failedVer.length > 0 && ![failedVersions containsObject:failedVer]) {
            [failedVersions addObject:failedVer];
        }
        json[@"failedVersions"] = failedVersions;

        NSString *prevVer = json[@"previousVersion"] ?: @"0.0.0";
        json[@"currentVersion"] = prevVer;
        json[@"pending"] = @NO;
        json[@"trial"] = @NO;
        json[@"ready"] = @YES;
    } else {
        json[@"trial"] = @YES;
    }

    NSData *updatedData = [NSJSONSerialization dataWithJSONObject:json options:NSJSONWritingPrettyPrinted error:nil];
    [updatedData writeToURL:stateURL atomically:YES];
}

+ (nullable NSURL *)currentBundleURL {
    if (!hasCheckedRollbackInProcess) {
        hasCheckedRollbackInProcess = YES;
        [self checkAndCleanIfNativeUpdated];
        [self checkAndRollbackIfPending];
    }

    NSURL *otaDir = [self getOTADirectory];
    if (!otaDir) return nil;

    NSString *bundlePath = [[otaDir.path stringByAppendingPathComponent:@"current"] stringByAppendingPathComponent:@"main.jsbundle"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:bundlePath]) {
        return nil;
    }
    return [NSURL fileURLWithPath:bundlePath];
}

@end
