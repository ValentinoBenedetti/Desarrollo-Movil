import { ExportService } from '../../src/services/export/exportService';
import { DatabaseService } from '../../src/services/database/databaseService';
import Share from 'react-native-share';
import { QoSMeasurementPoint } from '../../src/core/types/network';

describe('ExportService - RF-09 Exportación CSV (RFC 4180) y JSON', () => {
  const mockMeasurements: QoSMeasurementPoint[] = [
    {
      id: 'point-1',
      timestamp: 1700000000000,
      connectionType: 'cellular',
      isConnected: true,
      cellularInfo: {
        carrier: 'Telecom Personal',
        radioType: 'LTE',
        generation: '4G',
        signalStrengthDbm: -85,
        signalLevel: 3,
        isRegistered: true,
      },
      location: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 10,
        altitude: 20,
        speed: 1.5,
        timestamp: 1700000000000,
      },
      latency: {
        host: 'Google DNS',
        minMs: 20,
        avgMs: 25,
        maxMs: 30,
        jitterMs: 5,
        packetLossPercent: 0,
        samples: [20, 25, 30],
        timestamp: 1700000000000,
      },
      throughput: {
        direction: 'download',
        bytesTransferred: 5242880,
        durationMs: 1000,
        speedMbps: 41.94,
        timestamp: 1700000000000,
      },
    },
    {
      id: 'point-2',
      timestamp: 1700000010000,
      connectionType: 'wifi',
      isConnected: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(DatabaseService, 'getMeasurements').mockResolvedValue(mockMeasurements);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe exportar mediciones a JSON con formato estructurado', async () => {
    const jsonString = await ExportService.exportToJSON();
    expect(jsonString).toBeDefined();

    const parsed = JSON.parse(jsonString);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0].id).toBe('point-1');
    expect(parsed[0].cellularInfo.carrier).toBe('Telecom Personal');
  });

  it('debe generar formato CSV compatible con RFC 4180 conteniendo encabezados y filas escapadas', async () => {
    const csvString = await ExportService.exportToCSV();
    expect(csvString).toBeDefined();

    const lines = csvString.split('\n');
    expect(lines.length).toBe(3); // 1 header + 2 rows

    const headers = lines[0].split(',');
    expect(headers).toContain('id');
    expect(headers).toContain('timestamp');
    expect(headers).toContain('connection_type');
    expect(headers).toContain('carrier');
    expect(headers).toContain('signal_strength_dbm');
    expect(headers).toContain('latency_avg_ms');
    expect(headers).toContain('download_mbps');

    // Comprobar fila 1 con datos celulares
    expect(lines[1]).toContain('"point-1"');
    expect(lines[1]).toContain('"cellular"');
    expect(lines[1]).toContain('"Telecom Personal"');
    expect(lines[1]).toContain('"-85"');
    expect(lines[1]).toContain('"41.94"');

    // Comprobar fila 2 con campos ausentes pero estructura preservada
    expect(lines[2]).toContain('"point-2"');
    expect(lines[2]).toContain('"wifi"');
  });

  it('debe invocar Share.open con MIME type correcto al compartir', async () => {
    await ExportService.shareExport('csv');
    expect(Share.open).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text/csv',
        filename: expect.stringMatching(/^network_qos_\d+\.csv$/),
      })
    );

    await ExportService.shareExport('json');
    expect(Share.open).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'application/json',
        filename: expect.stringMatching(/^network_qos_\d+\.json$/),
      })
    );
  });
});
