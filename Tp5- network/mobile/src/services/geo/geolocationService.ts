import Geolocation from 'react-native-geolocation-service';
import { useNetworkStore } from '../../core/store/useNetworkStore';
import { GeoLocation } from '../../core/types/network';

export class GeolocationService {
  private static watchId: number | null = null;

  /**
   * Obtiene la posición GPS actual con alta precisión.
   */
  public static getCurrentLocation(): Promise<GeoLocation> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const loc: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            timestamp: position.timestamp,
          };
          useNetworkStore.getState().setCurrentLocation(loc);
          resolve(loc);
        },
        (error) => {
          console.warn('[Geolocation] Error al obtener ubicación actual:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
          forceRequestLocation: true,
          showLocationDialog: true,
        }
      );
    });
  }

  /**
   * Inicia el rastreo continuo de ubicación GPS para mapeo de cobertura en movimiento.
   */
  public static startTracking(intervalMs: number = 5000, distanceFilterMeters: number = 5): void {
    if (this.watchId !== null) {
      return;
    }

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const loc: GeoLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };
        useNetworkStore.getState().setCurrentLocation(loc);
      },
      (error) => {
        console.warn('[Geolocation] Error en watchPosition:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: distanceFilterMeters,
        interval: intervalMs,
        fastestInterval: Math.floor(intervalMs / 2),
      }
    );
  }

  /**
   * Detiene el rastreo continuo de GPS.
   */
  public static stopTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
