declare module 'react-native-sensors' {
  export interface SensorData {
    x: number;
    y: number;
    z: number;
    timestamp: number;
  }

  export interface Subscription {
    unsubscribe(): void;
  }

  export interface Observable<T> {
    subscribe(
      observerOrNext:
        | ((value: T) => void)
        | {
            next?: (value: T) => void;
            error?: (err: unknown) => void;
            complete?: () => void;
          }
    ): Subscription;
  }

  export const SensorTypes: {
    accelerometer: 'accelerometer';
    gyroscope: 'gyroscope';
    magnetometer: 'magnetometer';
    barometer: 'barometer';
  };

  export function setUpdateIntervalForType(
    type: 'accelerometer' | 'gyroscope' | 'magnetometer' | 'barometer',
    intervalMs: number
  ): void;

  export const magnetometer: Observable<SensorData>;
  export const accelerometer: Observable<SensorData>;
  export const gyroscope: Observable<SensorData>;
}

