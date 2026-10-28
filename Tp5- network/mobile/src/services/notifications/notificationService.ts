import notifee, { AndroidImportance } from '@notifee/react-native';
import { LatencyMetric, CellularInfo } from '../../core/types/network';

export class NotificationService {
  private static channelId = 'qos_degradation_channel';
  private static isInitialized = false;

  public static async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Crear canal de notificación prioritario para Android
    await notifee.createChannel({
      id: this.channelId,
      name: 'Alertas de Calidad de Red (QoS)',
      description: 'Notificaciones sobre degradación severa de latencia, señal o conectividad.',
      importance: AndroidImportance.HIGH,
      vibration: true,
    });

    this.isInitialized = true;
  }

  /**
   * Evalúa las métricas recientes y dispara notificación si se superan los umbrales de degradación.
   */
  public static async evaluateAndNotify(params: {
    isConnected: boolean;
    latency?: LatencyMetric;
    cellular?: CellularInfo | null;
  }): Promise<boolean> {
    await this.init();

    // 1. Pérdida total de conexión
    if (!params.isConnected) {
      await this.showNotification(
        'Conexión Perdida',
        'El dispositivo se encuentra sin conexión a Internet activa.'
      );
      return true;
    }

    // 2. Pérdida de paquetes severa (> 20%)
    if (params.latency && params.latency.packetLossPercent >= 20) {
      await this.showNotification(
        'Alta Pérdida de Paquetes',
        `Pérdida de paquetes del ${params.latency.packetLossPercent}% contra ${params.latency.host}.`
      );
      return true;
    }

    // 3. Latencia degradada (> 300 ms)
    if (params.latency && params.latency.avgMs > 300) {
      await this.showNotification(
        'Latencia Elevada',
        `Latencia RTT promedio de ${params.latency.avgMs}ms contra ${params.latency.host}.`
      );
      return true;
    }

    // 4. Jitter severo (> 80 ms)
    if (params.latency && params.latency.jitterMs > 80) {
      await this.showNotification(
        'Jitter Inestable',
        `Fluctuación de retardo (Jitter) de ${params.latency.jitterMs}ms detectada.`
      );
      return true;
    }

    // 5. Señal celular crítica (nivel 0 o dBm < -115)
    if (
      params.cellular &&
      params.cellular.signalStrengthDbm !== null &&
      params.cellular.signalStrengthDbm < -115
    ) {
      await this.showNotification(
        'Señal Celular Crítica',
        `Potencia de señal muy baja (${params.cellular.signalStrengthDbm} dBm) en red ${params.cellular.radioType}.`
      );
      return true;
    }

    return false;
  }

  private static async showNotification(title: string, body: string): Promise<void> {
    await notifee.displayNotification({
      title: `⚠️ QoS: ${title}`,
      body,
      android: {
        channelId: this.channelId,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
    });
  }
}
