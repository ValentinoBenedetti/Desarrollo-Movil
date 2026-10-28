import { PermissionsAndroid, Platform, Permission } from 'react-native';

export interface AppPermissionsStatus {
  hasFineLocation: boolean;
  hasCoarseLocation: boolean;
  hasPhoneState: boolean;
  hasPostNotifications: boolean;
}

export async function requestAndroidPermissions(): Promise<AppPermissionsStatus> {
  if (Platform.OS !== 'android') {
    return {
      hasFineLocation: true,
      hasCoarseLocation: true,
      hasPhoneState: true,
      hasPostNotifications: true,
    };
  }

  try {
    const permissionsToRequest: Permission[] = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ];

    // En Android 13+ (API 33) se requiere POST_NOTIFICATIONS
    if (Platform.Version >= 33) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

    return {
      hasFineLocation:
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED,
      hasCoarseLocation:
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED,
      hasPhoneState:
        granted[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] ===
        PermissionsAndroid.RESULTS.GRANTED,
      hasPostNotifications:
        Platform.Version >= 33
          ? granted[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] ===
            PermissionsAndroid.RESULTS.GRANTED
          : true,
    };
  } catch (error) {
    console.error('[Permissions] Error requesting permissions:', error);
    return {
      hasFineLocation: false,
      hasCoarseLocation: false,
      hasPhoneState: false,
      hasPostNotifications: false,
    };
  }
}
