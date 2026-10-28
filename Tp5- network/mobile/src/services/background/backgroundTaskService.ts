import BackgroundFetch from 'react-native-background-fetch';
import { useNetworkStore } from '../../core/store/useNetworkStore';
import { DatabaseService } from '../database/databaseService';
import { GeolocationService } from '../geo/geolocationService';
import { CellularInfoService } from '../native/CellularInfo';
import { NotificationService } from '../notifications/notificationService';
import { DEFAULT_PING_HOSTS, TcpPingService } from '../measurement/tcpPingService';
import { QoSMeasurementPoint } from '../../core/types/network';

export class BackgroundTaskService {
  private static liveIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Inicializa el servicio de muestreo en segundo plano nativo (Background Fetch).
   */
  public static async initBackgroundFetch(): Promise<void> {
    await NotificationService.init();

    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15, // minutos (mínimo permitido por Android/iOS)
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      },
      async (taskId: string) => {
        console.log(`[BackgroundFetch] Ejecutando muestreo periódico: ${taskId}`);
        await this.executeSamplingCycle();
        BackgroundFetch.finish(taskId);
      },
      (error: string) => {
        console.error('[BackgroundFetch] Error de configuración:', error);
      }
    );

    console.log('[BackgroundFetch] Estado inicial:', status);
  }

  /**
   * Ejecuta una ronda de muestreo de métricas (red, GPS, latencia, persistencia y alerta).
   */
  public static async executeSamplingCycle(): Promise<QoSMeasurementPoint> {
    const store = useNetworkStore.getState();

    // 1. Obtener telemetría celular
    const cellularInfo = await CellularInfoService.getCellularInfo();
    store.setCellularInfo(cellularInfo);

    // 2. Obtener GPS
    let location;
    try {
      location = await GeolocationService.getCurrentLocation();
    } catch {
      // Ignorar si GPS no está disponible
    }

    // 3. Ping rápido TCP
    let latency;
    try {
      latency = await TcpPingService.runPingTest(DEFAULT_PING_HOSTS[0], 3, 2500);
      store.setLatencyMetric(latency);
    } catch (e) {
      console.warn('[BackgroundSampling] Error en sonda TCP:', e);
    }

    // 4. Consolidar punto
    const point: QoSMeasurementPoint = {
      id: `bg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      connectionType: store.connectionType,
      isConnected: store.isConnected,
      cellularInfo,
      location,
      latency,
    };

    // 5. Persistir en SQLite
    try {
      await DatabaseService.insertMeasurement(point);
      store.addMeasurementPoint(point);
    } catch (dbErr) {
      console.error('[BackgroundSampling] Error al persistir:', dbErr);
    }

    // 6. Evaluar degradación severa y notificar si corresponde
    await NotificationService.evaluateAndNotify({
      isConnected: store.isConnected,
      latency,
      cellular: cellularInfo,
    });

    return point;
  }

  /**
   * Inicia muestreo en primer plano continuo (cada N segundos) para sesiones activas.
   */
  public static startLiveSampling(intervalSeconds: number = 10): void {
    if (this.liveIntervalId) {
      return;
    }

    // Ejecuta inmediatamente la primera muestra
    this.executeSamplingCycle();

    this.liveIntervalId = setInterval(() => {
      this.executeSamplingCycle();
    }, intervalSeconds * 1000);
  }

  /**
   * Detiene el muestreo en primer plano.
   */
  public static stopLiveSampling(): void {
    if (this.liveIntervalId) {
      clearInterval(this.liveIntervalId);
      this.liveIntervalId = null;
    }
  }
}
