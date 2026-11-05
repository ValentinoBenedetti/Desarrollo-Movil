import { Q } from '@nozbe/watermelondb';
import {
  InstallationOrderInput,
  OutboxEventType,
  SnmpDiagnosticSummary,
} from '../../core/types';
import { database } from '../store/database';
import { Diagnostic, Installation, OutboxItem } from '../store/models';
import { TABLE_NAMES } from '../store/schema';

export interface OutboxStats {
  pendingCount: number;
  inFlightCount: number;
  syncedCount: number;
  failedCount: number;
}

/**
 * Transactional Outbox Manager implementing Martin Fowler's Offline-First Outbox Pattern.
 * Guarantees that every domain mutation (Diagnostic or Installation) is persisted
 * atomically alongside its OutboxQueue synchronization envelope inside a single SQLite transaction.
 */
export class OutboxManager {
  public static readonly MAX_RETRY_ATTEMPTS = 6;

  /**
   * Atomically persists a Diagnostic snapshot and enqueues a `SYNC_DIAGNOSTIC` event
   * inside a single WatermelonDB batch transaction.
   */
  public async recordDiagnosticAndEnqueue(params: {
    deviceId: string;
    deviceIp: string;
    snmpSummary: SnmpDiagnosticSummary | null;
    sshOutput: string;
  }): Promise<{ diagnostic: Diagnostic; outboxItem: OutboxItem }> {
    const diagnosticsCollection = database.get<Diagnostic>(TABLE_NAMES.DIAGNOSTICS);
    const outboxCollection = database.get<OutboxItem>(TABLE_NAMES.OUTBOX_QUEUE);
    const now = Date.now();

    return database.write(async () => {
      const diagnostic = diagnosticsCollection.prepareCreate(record => {
        record.deviceId = params.deviceId;
        record.snmpSummaryRaw = params.snmpSummary ? JSON.stringify(params.snmpSummary) : '';
        record.sshOutput = params.sshOutput || '';
        record.createdAt = now;
      });

      const outboxPayload = {
        diagnosticId: diagnostic.id,
        deviceId: params.deviceId,
        deviceIp: params.deviceIp,
        snmpSummary: params.snmpSummary,
        sshOutput: params.sshOutput,
        createdAtIso: new Date(now).toISOString(),
      };

      const outboxItem = outboxCollection.prepareCreate(item => {
        item.eventType = 'SYNC_DIAGNOSTIC';
        item.payloadRaw = JSON.stringify(outboxPayload);
        item.attempts = 0;
        item.status = 'PENDING';
        item.lastError = '';
        item.nextRetryAt = now;
        item.createdAt = now;
      });

      await database.batch(diagnostic, outboxItem);
      return { diagnostic, outboxItem };
    });
  }

  /**
   * Atomically persists a Field Installation Order (with PDF & Photo URIs and GPS coordinates)
   * and enqueues a `SYNC_INSTALLATION` event inside a single WatermelonDB batch transaction.
   */
  public async recordInstallationAndEnqueue(
    order: InstallationOrderInput,
    pdfUri: string,
    reportId: string,
  ): Promise<{ installation: Installation; outboxItem: OutboxItem }> {
    const installationsCollection = database.get<Installation>(TABLE_NAMES.INSTALLATIONS);
    const outboxCollection = database.get<OutboxItem>(TABLE_NAMES.OUTBOX_QUEUE);
    const now = Date.now();

    return database.write(async () => {
      const installation = installationsCollection.prepareCreate(record => {
        record.deviceId = order.deviceId;
        record.siteName = order.siteName;
        record.technicianId = order.technicianId;
        record.serialNumber = order.serialNumber;
        record.equipmentModel = order.equipmentModel;
        record.notes = order.notes;
        record.latitude = order.coordinates.latitude;
        record.longitude = order.coordinates.longitude;
        record.photoUri = order.photoUri;
        record.pdfUri = pdfUri;
        record.status = 'PENDING_SYNC';
        record.createdAt = now;
      });

      const outboxPayload = {
        installationId: installation.id,
        reportId,
        deviceId: order.deviceId,
        deviceIp: order.deviceIp,
        deviceMac: order.deviceMac,
        deviceHostname: order.deviceHostname,
        serialNumber: order.serialNumber,
        equipmentModel: order.equipmentModel,
        siteName: order.siteName,
        technicianId: order.technicianId,
        notes: order.notes,
        coordinates: order.coordinates,
        photoUri: order.photoUri,
        pdfUri,
        snmpSummary: order.snmpSummary ?? null,
        sshOutput: order.sshOutput ?? '',
        createdAtIso: new Date(now).toISOString(),
      };

      const outboxItem = outboxCollection.prepareCreate(item => {
        item.eventType = 'SYNC_INSTALLATION';
        item.payloadRaw = JSON.stringify(outboxPayload);
        item.attempts = 0;
        item.status = 'PENDING';
        item.lastError = '';
        item.nextRetryAt = now;
        item.createdAt = now;
      });

      await database.batch(installation, outboxItem);
      return { installation, outboxItem };
    });
  }

  /**
   * Fetches a FIFO batch of Outbox items ready for transmission (`PENDING` or retry-eligible `FAILED`).
   */
  public async fetchNextBatch(batchSize = 10): Promise<OutboxItem[]> {
    const now = Date.now();
    const outboxCollection = database.get<OutboxItem>(TABLE_NAMES.OUTBOX_QUEUE);

    const eligibleItems = await outboxCollection
      .query(
        Q.where('status', Q.oneOf(['PENDING', 'FAILED'])),
        Q.where('attempts', Q.lt(OutboxManager.MAX_RETRY_ATTEMPTS)),
        Q.where('next_retry_at', Q.lte(now)),
        Q.sortBy('created_at', Q.asc),
      )
      .fetch();

    return eligibleItems.slice(0, batchSize);
  }

  /**
   * Transitions a batch of Outbox items to `IN_FLIGHT` before network dispatch.
   */
  public async markInFlight(items: readonly OutboxItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await database.write(async () => {
      const updates = items.map(item =>
        item.prepareUpdate(rec => {
          rec.status = 'IN_FLIGHT';
        }),
      );
      await database.batch(...updates);
    });
  }

  /**
   * Marks successfully synchronized Outbox items as `SYNCED` and updates any linked
   * Installation entities to `SYNCED`.
   */
  public async markSynced(items: readonly OutboxItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const installationsCollection = database.get<Installation>(TABLE_NAMES.INSTALLATIONS);
    const installationIdsToUpdate: string[] = [];

    for (const item of items) {
      if (item.eventType === 'SYNC_INSTALLATION') {
        const payload = item.parsedPayload;
        if (typeof payload.installationId === 'string') {
          installationIdsToUpdate.push(payload.installationId);
        }
      }
    }

    const linkedInstallations =
      installationIdsToUpdate.length > 0
        ? await installationsCollection
            .query(Q.where('id', Q.oneOf(installationIdsToUpdate)))
            .fetch()
        : [];

    await database.write(async () => {
      const outboxUpdates = items.map(item =>
        item.prepareUpdate(rec => {
          rec.status = 'SYNCED';
          rec.lastError = '';
        }),
      );
      const installationUpdates = linkedInstallations.map(inst =>
        inst.prepareUpdate(rec => {
          rec.status = 'SYNCED';
        }),
      );
      await database.batch(...outboxUpdates, ...installationUpdates);
    });
  }

  /**
   * Records a failed synchronization attempt and computes exponential backoff:
   * delayMs = 2^attempts * 1000 ms.
   */
  public static computeExponentialBackoffMs(attemptNumber: number): number {
    const clampedExponent = Math.max(1, Math.min(attemptNumber, 10));
    return Math.pow(2, clampedExponent) * 1000;
  }

  public async markFailedWithBackoff(
    items: readonly OutboxItem[],
    errorMessage: string,
  ): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    let minDelayMs = Number.MAX_SAFE_INTEGER;
    const now = Date.now();

    await database.write(async () => {
      const updates = items.map(item => {
        const nextAttempt = item.attempts + 1;
        const backoffMs = OutboxManager.computeExponentialBackoffMs(nextAttempt);
        if (backoffMs < minDelayMs) {
          minDelayMs = backoffMs;
        }
        return item.prepareUpdate(rec => {
          rec.attempts = nextAttempt;
          rec.status =
            nextAttempt >= OutboxManager.MAX_RETRY_ATTEMPTS ? 'FAILED' : 'PENDING';
          rec.lastError = errorMessage;
          rec.nextRetryAt = now + backoffMs;
        });
      });
      await database.batch(...updates);
    });

    return minDelayMs === Number.MAX_SAFE_INTEGER ? 2000 : minDelayMs;
  }

  /**
   * Resets failed items so the technician can manually force an immediate retry.
   */
  public async resetFailedItemsForImmediateRetry(): Promise<number> {
    const outboxCollection = database.get<OutboxItem>(TABLE_NAMES.OUTBOX_QUEUE);
    const retryable = await outboxCollection
      .query(Q.where('status', Q.oneOf(['FAILED', 'PENDING'])))
      .fetch();

    if (retryable.length === 0) {
      return 0;
    }

    const now = Date.now();
    await database.write(async () => {
      const updates = retryable.map(item =>
        item.prepareUpdate(rec => {
          rec.status = 'PENDING';
          rec.attempts = 0;
          rec.nextRetryAt = now;
        }),
      );
      await database.batch(...updates);
    });

    return retryable.length;
  }

  /**
   * Computes current queue statistics across all Outbox states.
   */
  public async getStats(): Promise<OutboxStats> {
    const all = await database.get<OutboxItem>(TABLE_NAMES.OUTBOX_QUEUE).query().fetch();
    let pendingCount = 0;
    let inFlightCount = 0;
    let syncedCount = 0;
    let failedCount = 0;

    for (const item of all) {
      if (item.status === 'PENDING') {
        pendingCount++;
      } else if (item.status === 'IN_FLIGHT') {
        inFlightCount++;
      } else if (item.status === 'SYNCED') {
        syncedCount++;
      } else if (item.status === 'FAILED') {
        failedCount++;
      }
    }

    return {
      pendingCount,
      inFlightCount,
      syncedCount,
      failedCount,
    };
  }
}

export const outboxManager = new OutboxManager();

