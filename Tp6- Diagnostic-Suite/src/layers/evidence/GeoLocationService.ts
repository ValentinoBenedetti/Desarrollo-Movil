import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import { GeoCoordinates } from '../../core/types';

/**
 * High-Precision GPS Georeferencing Service for Telecom Field Installations.
 * Requests fine location hardware permissions and obtains satellite/fused fixes
 * stamped with strict UTC ISO-8601 timestamps.
 */
export class GeoLocationService {
  /**
   * Requests OS-level fine location permissions on Android and iOS.
   */
  public async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted';
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'High-Precision GPS Permission Required',
          message:
            'Network Diagnostics Suite requires GPS access to georeference telecom equipment installations and evidence photos.',
          buttonPositive: 'Grant Permission',
          buttonNegative: 'Cancel',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return false;
  }

  /**
   * Acquires a high-accuracy GPS fix with UTC timestamp.
   */
  public async getCurrentCoordinates(timeoutMs = 15000): Promise<GeoCoordinates> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      throw new Error('Fine GPS location permission was denied by the operator');
    }

    return new Promise<GeoCoordinates>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position: GeoPosition) => {
          resolve({
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
            altitude:
              position.coords.altitude !== null && position.coords.altitude !== undefined
                ? Number(position.coords.altitude.toFixed(2))
                : null,
            accuracyMeters: Number((position.coords.accuracy ?? 0).toFixed(2)),
            timestampUtc: new Date(position.timestamp || Date.now()).toISOString(),
          });
        },
        error => {
          reject(new Error(`GPS fix failed (code ${error.code}): ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 5000,
          forceRequestLocation: true,
          showLocationDialog: true,
        },
      );
    });
  }

  /**
   * Formats decimal coordinates into a human-readable DMS / telemetry string.
   */
  public static formatCoordinates(coords: GeoCoordinates): string {
    const latDir = coords.latitude >= 0 ? 'N' : 'S';
    const lonDir = coords.longitude >= 0 ? 'E' : 'W';
    const altPart = coords.altitude !== null ? ` | Alt: ${coords.altitude}m` : '';
    return `${Math.abs(coords.latitude).toFixed(6)}° ${latDir}, ${Math.abs(coords.longitude).toFixed(6)}° ${lonDir} (±${coords.accuracyMeters}m${altPart})`;
  }
}

export const geoLocationService = new GeoLocationService();

