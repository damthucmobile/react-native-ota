#if __has_include(<React/RCTBridgeModule.h>)
#import <React/RCTBridgeModule.h>
#elif __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#endif

#ifndef RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD
#define RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(method) _RCT_EXTERN_REMAP_METHOD(, method, YES)
#endif

@interface RCT_EXTERN_MODULE(OTAUpdater, NSObject)

RCT_EXTERN_METHOD(unzip:(NSString *)zipPath
                  targetDir:(NSString *)targetDir
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(markReady:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getCurrentVersion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(applyDelta:(NSString *)baseFilePath
                  patchFilePath:(NSString *)patchFilePath
                  outputFilePath:(NSString *)outputFilePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(restart:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getNativeVersion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(getLocalAssets)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(getMainBundleURL)

@end
