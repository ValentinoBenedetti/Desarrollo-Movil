import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import { QoSMeasurementPoint } from '../../core/types/network';

SQLite.enablePromise(true);

export interface FilterOptions {
  networkType?: string;
  carrier?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
}

export class DatabaseService {
  private static dbInstance: SQLiteDatabase | null = null;

  public static async getDb(): Promise<SQLiteDatabase> {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    this.dbInstance = await SQLite.openDatabase({
      name: 'network_qos.db',
      location: 'default',
    });

    await this.initSchema(this.dbInstance);
    return this.dbInstance;
  }

  private static async initSchema(db: SQLiteDatabase): Promise<void> {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS measurements (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        connection_type TEXT,
        is_connected INTEGER,
        carrier TEXT,
        radio_type TEXT,
        generation TEXT,
        signal_strength_dbm INTEGER,
        signal_level INTEGER,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        ping_host TEXT,
        latency_min_ms REAL,
        latency_avg_ms REAL,
        latency_max_ms REAL,
        jitter_ms REAL,
        packet_loss_percent REAL,
        download_mbps REAL,
        upload_mbps REAL
      );
    `);

    // Índices para acelerar búsquedas de heatmaps y filtros temporales
    await db.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_measurements_ts ON measurements(timestamp);'
    );
    await db.executeSql(
      'CREATE INDEX IF NOT EXISTS idx_measurements_net ON measurements(connection_type, generation);'
    );
  }

  public static async insertMeasurement(point: QoSMeasurementPoint): Promise<void> {
    const db = await this.getDb();
    const query = `
      INSERT OR REPLACE INTO measurements (
        id, timestamp, connection_type, is_connected, carrier, radio_type, generation,
        signal_strength_dbm, signal_level, latitude, longitude, accuracy, ping_host,
        latency_min_ms, latency_avg_ms, latency_max_ms, jitter_ms, packet_loss_percent,
        download_mbps, upload_mbps
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      point.id,
      point.timestamp,
      point.connectionType,
      point.isConnected ? 1 : 0,
      point.cellularInfo?.carrier || null,
      point.cellularInfo?.radioType || null,
      point.cellularInfo?.generation || null,
      point.cellularInfo?.signalStrengthDbm ?? null,
      point.cellularInfo?.signalLevel ?? null,
      point.location?.latitude ?? null,
      point.location?.longitude ?? null,
      point.location?.accuracy ?? null,
      point.latency?.host || null,
      point.latency?.minMs ?? null,
      point.latency?.avgMs ?? null,
      point.latency?.maxMs ?? null,
      point.latency?.jitterMs ?? null,
      point.latency?.packetLossPercent ?? null,
      point.throughput?.direction === 'download' ? point.throughput.speedMbps : null,
      null, // upload se actualiza si está disponible
    ];

    await db.executeSql(query, params);
  }

  public static async getMeasurements(filters?: FilterOptions): Promise<QoSMeasurementPoint[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM measurements WHERE 1=1';
    const params: (string | number)[] = [];

    if (filters?.networkType) {
      query += ' AND (connection_type = ? OR generation = ?)';
      params.push(filters.networkType, filters.networkType);
    }

    if (filters?.carrier) {
      query += ' AND carrier LIKE ?';
      params.push(`%${filters.carrier}%`);
    }

    if (filters?.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const [results] = await db.executeSql(query, params);
    const rows: QoSMeasurementPoint[] = [];

    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      rows.push({
        id: row.id,
        timestamp: row.timestamp,
        connectionType: row.connection_type,
        isConnected: Boolean(row.is_connected),
        cellularInfo: row.carrier
          ? {
              carrier: row.carrier,
              radioType: row.radio_type,
              generation: row.generation,
              signalStrengthDbm: row.signal_strength_dbm,
              signalLevel: row.signal_level,
              isRegistered: true,
            }
          : undefined,
        location:
          row.latitude !== null && row.longitude !== null
            ? {
                latitude: row.latitude,
                longitude: row.longitude,
                accuracy: row.accuracy,
                altitude: null,
                speed: null,
                timestamp: row.timestamp,
              }
            : undefined,
        latency: row.ping_host
          ? {
              host: row.ping_host,
              minMs: row.latency_min_ms,
              avgMs: row.latency_avg_ms,
              maxMs: row.latency_max_ms,
              jitterMs: row.jitter_ms,
              packetLossPercent: row.packet_loss_percent,
              samples: [],
              timestamp: row.timestamp,
            }
          : undefined,
        throughput:
          row.download_mbps !== null
            ? {
                direction: 'download',
                bytesTransferred: 0,
                durationMs: 0,
                speedMbps: row.download_mbps,
                timestamp: row.timestamp,
              }
            : undefined,
      });
    }

    return rows;
  }

  public static async getHeatmapPoints(): Promise<
    Array<{ latitude: number; longitude: number; weight: number }>
  > {
    const db = await this.getDb();
    const [results] = await db.executeSql(`
      SELECT latitude, longitude, signal_level, download_mbps
      FROM measurements
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `);

    const points: Array<{ latitude: number; longitude: number; weight: number }> = [];

    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      // Ponderación de 0.1 a 1.0 basada en nivel de señal (0-4) o throughput
      let weight = 0.5;
      if (typeof row.signal_level === 'number') {
        weight = Math.max(0.2, Math.min(1.0, (row.signal_level + 1) / 5));
      } else if (typeof row.download_mbps === 'number') {
        weight = Math.max(0.2, Math.min(1.0, row.download_mbps / 50));
      }

      points.push({
        latitude: row.latitude,
        longitude: row.longitude,
        weight: parseFloat(weight.toFixed(2)),
      });
    }

    return points;
  }

  public static async clearAll(): Promise<void> {
    const db = await this.getDb();
    await db.executeSql('DELETE FROM measurements;');
  }

  public static async seedDemoRoute(): Promise<void> {
    const db = await this.getDb();

    // Puntos de cobertura realistas en Concepción del Uruguay (Boulevard Yrigoyen, Plaza Ramírez, FCyT)
    const waypoints = [
      { lat: -32.4760, lng: -58.2355, signal: -78, level: 4, rtt: 24, dl: 88.5, carrier: 'Personal 4G' },
      { lat: -32.4775, lng: -58.2340, signal: -81, level: 4, rtt: 27, dl: 79.2, carrier: 'Personal 4G' },
      { lat: -32.4794, lng: -58.2320, signal: -84, level: 3, rtt: 29, dl: 75.1, carrier: 'Personal 4G' },
      { lat: -32.4812, lng: -58.2310, signal: -88, level: 3, rtt: 35, dl: 52.4, carrier: 'Personal 4G' },
      { lat: -32.4830, lng: -58.2300, signal: -74, level: 4, rtt: 21, dl: 112.3, carrier: 'Personal 5G' }, // Plaza Ramírez
      { lat: -32.4845, lng: -58.2285, signal: -82, level: 3, rtt: 28, dl: 68.0, carrier: 'Personal 4G' },
      { lat: -32.4862, lng: -58.2265, signal: -92, level: 2, rtt: 42, dl: 31.5, carrier: 'Personal 4G' },
      { lat: -32.4885, lng: -58.2235, signal: -108, level: 1, rtt: 78, dl: 8.4, carrier: 'Personal 4G' }, // Costanera / Isla
      { lat: -32.4870, lng: -58.2210, signal: -112, level: 1, rtt: 94, dl: 5.1, carrier: 'Personal 3G' },
      { lat: -32.4815, lng: -58.2365, signal: -77, level: 4, rtt: 23, dl: 95.0, carrier: 'Personal 4G' }, // FCyT Campus
      { lat: -32.4828, lng: -58.2385, signal: -85, level: 3, rtt: 31, dl: 62.7, carrier: 'Personal 4G' },
      { lat: -32.4750, lng: -58.2280, signal: -89, level: 3, rtt: 38, dl: 44.8, carrier: 'Personal 4G' },
      { lat: -32.4735, lng: -58.2250, signal: -96, level: 2, rtt: 49, dl: 26.2, carrier: 'Personal 4G' },
      { lat: -32.4715, lng: -58.2330, signal: -104, level: 1, rtt: 65, dl: 14.5, carrier: 'Personal 4G' },
      { lat: -32.4855, lng: -58.2345, signal: -83, level: 3, rtt: 29, dl: 66.4, carrier: 'Personal 4G' },
    ];

    const now = Date.now();
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const pointId = `demo-route-${i}-${now}`;
      const pointTime = now - (waypoints.length - i) * 120000;

      const query = `
        INSERT OR REPLACE INTO measurements (
          id, timestamp, connection_type, is_connected, carrier, radio_type, generation,
          signal_strength_dbm, signal_level, latitude, longitude, accuracy, ping_host,
          latency_min_ms, latency_avg_ms, latency_max_ms, jitter_ms, packet_loss_percent,
          download_mbps, upload_mbps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      await db.executeSql(query, [
        pointId,
        pointTime,
        'cellular',
        1,
        'Personal',
        'LTE',
        wp.carrier.includes('5G') ? '5G' : wp.carrier.includes('3G') ? '3G' : '4G',
        wp.signal,
        wp.level,
        wp.lat,
        wp.lng,
        4.5,
        '8.8.8.8',
        wp.rtt - 4,
        wp.rtt,
        wp.rtt + 8,
        parseFloat((wp.rtt * 0.25).toFixed(2)),
        0,
        wp.dl,
        parseFloat((wp.dl * 0.35).toFixed(2)),
      ]);
    }
  }
}
