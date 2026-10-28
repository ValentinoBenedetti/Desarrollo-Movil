import { useNetworkStore } from '../../core/store/useNetworkStore';
import { QoSMeasurementPoint } from '../../core/types/network';
import { DatabaseService } from '../database/databaseService';
import { GeolocationService } from '../geo/geolocationService';
import { CellularInfoService } from '../native/CellularInfo';
import { PingHostConfig, TcpPingService } from './tcpPingService';
import { ThroughputConfig, ThroughputService } from './throughputService';

export class MeasurementOrchestrator {
  /**
   * Ejecuta un ciclo completo de diagnóstico de calidad de servicio (QoS):
   * 1. Lectura de estado celular nativo y GPS
   * 2. Sonda TCP RTT / Jitter
   * 3. Test de throughput (bajada y subida)
   * 4. Consolidación del punto de medición, actualización del Store y persistencia SQLite
   */
  public static async runDiagnostics(options?: {
    pingTarget?: PingHostConfig;
    throughputConfig?: ThroughputConfig;
  }): Promise<QoSMeasurementPoint> {
    const store = useNetworkStore.getState();

    const pingTarget = options?.pingTarget || {
      name: 'Host Configurado',
      host: store.pingHost || '8.8.8.8',
      port: 53,
    };
    const throughputCfg: ThroughputConfig = options?.throughputConfig || {
      baseUrl: store.backendUrl || 'http://192.168.0.32:3000',
      downloadSizeMb: 5,
      uploadSizeMb: 2,
    };

    // 1. Obtener telemetría celular y GPS actual
    const cellularInfo = await CellularInfoService.getCellularInfo();
    store.setCellularInfo(cellularInfo);

    try {
      await GeolocationService.getCurrentLocation();
    } catch {
      // Si el GPS falla o el usuario no otorgó permisos, continuamos con las pruebas de red
    }

    // 2. Medición de Latencia y Jitter TCP
    store.setIsTestingLatency(true);
    let latencyMetric;
    try {
      latencyMetric = await TcpPingService.runPingTest(pingTarget);
      store.setLatencyMetric(latencyMetric);
    } catch (err) {
      console.warn('[Orchestrator] Error en test de latencia:', err);
    } finally {
      store.setIsTestingLatency(false);
    }

    // 3. Test de Throughput (Download & Upload)
    store.setIsTestingThroughput(true);
    let downloadMetric;
    let uploadMetric;
    try {
      downloadMetric = await ThroughputService.measureDownload(throughputCfg);
      store.setThroughputMetric(downloadMetric);

      uploadMetric = await ThroughputService.measureUpload(throughputCfg);
      store.setThroughputMetric(uploadMetric);
    } catch (err) {
      console.warn('[Orchestrator] Error en test de throughput:', err);
    } finally {
      store.setIsTestingThroughput(false);
    }

    // 4. Consolidar punto de medición
    const point: QoSMeasurementPoint = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      connectionType: store.connectionType,
      isConnected: store.isConnected,
      cellularInfo,
      location: store.currentLocation || undefined,
      latency: latencyMetric,
      throughput: downloadMetric,
    };

    store.addMeasurementPoint(point);

    // 5. Persistir en SQLite de forma asíncrona
    try {
      await DatabaseService.insertMeasurement(point);
    } catch (dbErr) {
      console.error('[Orchestrator] Error persistiendo en SQLite:', dbErr);
    }

    return point;
  }
}
