#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(CellularInfoModule, NSObject)

RCT_EXTERN_METHOD(getCellularInfo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
