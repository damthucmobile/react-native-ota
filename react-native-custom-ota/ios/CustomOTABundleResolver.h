#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface CustomOTABundleResolver : NSObject

+ (nullable NSURL *)getOTADirectory;
+ (nullable NSURL *)currentBundleURL;
+ (nullable NSURL *)stateURL;
+ (void)checkAndRollbackIfPending;
+ (void)checkAndCleanIfNativeUpdated;

@end

NS_ASSUME_NONNULL_END
