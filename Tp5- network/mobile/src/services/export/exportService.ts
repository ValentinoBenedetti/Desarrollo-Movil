import Share from 'react-native-share';
import { Buffer } from 'buffer';
import { DatabaseService, FilterOptions } from '../database/databaseService';
import { QoSMeasurementPoint } from '../../core/types/network';

export class ExportService {
  /**
   * Genera una cadena JSON formateada con todas las mediciones coincidentes.
   */
  public static async exportToJSON(filters?: FilterOptions): Promise<string> {
    const data = await DatabaseService.getMeasurements(filters);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Genera una cadena CSV compatible con RFC 4180 lista para importar en Excel/GIS.
   */
  public static async exportToCSV(filters?: FilterOptions): Promise<string> {
    const data = await DatabaseService.getMeasurements(filters);

    const headers = [
      'id',
      'timestamp',
      'iso_date',
      'connection_type',
      'carrier',
      'radio_type',
      'generation',
      'signal_strength_dbm',
      'signal_level',
      'latitude',
      'longitude',
      'accuracy_meters',
      'ping_host',
      'latency_avg_ms',
      'jitter_ms',
      'packet_loss_percent',
      'download_mbps',
    ];

    const rows = data.map((point: QoSMeasurementPoint) => {
      return [
        point.id,
        point.timestamp,
        new Date(point.timestamp).toISOString(),
        point.connectionType,
        point.cellularInfo?.carrier || '',
        point.cellularInfo?.radioType || '',
        point.cellularInfo?.generation || '',
        point.cellularInfo?.signalStrengthDbm ?? '',
        point.cellularInfo?.signalLevel ?? '',
        point.location?.latitude ?? '',
        point.location?.longitude ?? '',
        point.location?.accuracy ?? '',
        point.latency?.host || '',
        point.latency?.avgMs ?? '',
        point.latency?.jitterMs ?? '',
        point.latency?.packetLossPercent ?? '',
        point.throughput?.speedMbps ?? '',
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Dispara el menú nativo de compartir para guardar o enviar el archivo CSV o JSON.
   */
  public static async shareExport(format: 'csv' | 'json', filters?: FilterOptions): Promise<void> {
    const isCsv = format === 'csv';
    const content = isCsv
      ? await this.exportToCSV(filters)
      : await this.exportToJSON(filters);

    const filename = `network_qos_${Date.now()}.${format}`;
    const mimeType = isCsv ? 'text/csv' : 'application/json';

    // Base64 data URI para compartir sin requerir acceso previo al filesystem nativo
    const base64Data = Buffer.from(content, 'utf-8').toString('base64');
    const url = `data:${mimeType};base64,${base64Data}`;

    await Share.open({
      title: `Exportar mediciones QoS (${format.toUpperCase()})`,
      filename,
      url,
      type: mimeType,
      failOnCancel: false,
    });
  }
}
