import { Database, Q } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { DiscoveredDevice } from '../../core/types';
import { Device, Diagnostic, Installation, modelClasses, OutboxItem } from './models';
import { databaseSchema, TABLE_NAMES } from './schema';

const sqliteAdapter = new SQLiteAdapter({
  schema: databaseSchema,
  dbName: 'network_diagnostics_suite_db',
  jsi: true,
  onSetUpError: error => {
    console.error('[WatermelonDB] Failed to initialize native SQLite adapter:', error);
  },
});

export const database = new Database({
  adapter: sqliteAdapter,
  modelClasses,
});

/**
 * Repository helper functions for reactive offline-first queries and atomic mutations.
 */
export class StoreRepository {
  /**
   * Upserts a discovered network node by IP address into WatermelonDB.
   */
  public static async upsertDiscoveredDevice(
    discovered: DiscoveredDevice,
    serialNumber?: string,
    equipmentModel?: string,
  ): Promise<Device> {
    const devicesCollection = database.get<Device>(TABLE_NAMES.DEVICES);
    const existingList = await devicesCollection
      .query(Q.where('ip', discovered.ip))
      .fetch();

    return database.write(async () => {
      if (existingList.length > 0) {
        const existing = existingList[0];
        return existing.update(record => {
          record.mac =
            discovered.mac && !discovered.mac.startsWith('N/A')
              ? discovered.mac
              : record.mac;
          record.hostname =
            discovered.hostname && discovered.hostname !== discovered.ip
              ? discovered.hostname
              : record.hostname;
          record.vendor =
            discovered.vendor && discovered.vendor !== 'Unknown Vendor'
              ? discovered.vendor
              : record.vendor;
          if (serialNumber) {
            record.serialNumber = serialNumber;
          }
          if (equipmentModel) {
            record.equipmentModel = equipmentModel;
          }
          record.lastSeen = discovered.lastSeen || Date.now();
        });
      }

      return devicesCollection.create(record => {
        record.ip = discovered.ip;
        record.mac = discovered.mac || 'N/A';
        record.hostname = discovered.hostname || discovered.ip;
        record.vendor = discovered.vendor || 'Unknown Vendor';
        record.serialNumber = serialNumber ?? discovered.serialCode ?? '';
        record.equipmentModel = equipmentModel ?? '';
        record.lastSeen = discovered.lastSeen || Date.now();
      });
    });
  }

  /**
   * Lists all locally persisted devices sorted by most recently seen.
   */
  public static async listDevices(): Promise<Device[]> {
    return database
      .get<Device>(TABLE_NAMES.DEVICES)
      .query(Q.sortBy('last_seen', Q.desc))
      .fetch();
  }

  /**
   * Lists all diagnostics sorted by newest first, optionally filtered by `deviceId`.
   */
  public static async listDiagnostics(deviceId?: string): Promise<Diagnostic[]> {
    const collection = database.get<Diagnostic>(TABLE_NAMES.DIAGNOSTICS);
    if (deviceId) {
      return collection
        .query(Q.where('device_id', deviceId), Q.sortBy('created_at', Q.desc))
        .fetch();
    }
    return collection.query(Q.sortBy('created_at', Q.desc)).fetch();
  }

  /**
   * Lists all field installation records sorted by newest first.
   */
  public static async listInstallations(deviceId?: string): Promise<Installation[]> {
    const collection = database.get<Installation>(TABLE_NAMES.INSTALLATIONS);
    if (deviceId) {
      return collection
        .query(Q.where('device_id', deviceId), Q.sortBy('created_at', Q.desc))
        .fetch();
    }
    return collection.query(Q.sortBy('created_at', Q.desc)).fetch();
  }

  /**
   * Lists all OutboxQueue entries sorted by creation order (FIFO).
   */
  public static async listOutboxItems(): Promise<OutboxItem[]> {
    return database
      .get<OutboxItem>(TABLE_NAMES.OUTBOX_QUEUE)
      .query(Q.sortBy('created_at', Q.asc))
      .fetch();
  }
}

