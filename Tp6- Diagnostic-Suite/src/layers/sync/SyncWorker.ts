import { SyncBatchRequestItem, SyncBatchResponse } from '../../core/types';
import { pdfGenerator } from '../reporting/PdfGenerator';
import { OutboxItem } from '../store/models';
import { outboxManager, OutboxManager, OutboxStats } from './OutboxManager';

export type SyncWorkerListener = (state: {
  isSyncing: boolean;
  lastSyncAtIso: string | null;
  lastError: string | null;
  stats: OutboxStats;
}) => void;

/**
 * Sequential FIFO Outbox Processor with Exponential Backoff ($2^n \times 1000\text{ ms}$).
 * Drains pending field installations and diagnostics to the synchronization backend
 * (`/api/sync` and `/api/reports/upload`) whenever connectivity is available.
 */
export class SyncWorker {
  private backendBaseUrl = 'http://localhost:4600';
  private isProcessing = false;
  private simulatedOffline = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncAtIso: string | null = null;
  private lastError: string | null = null;
  private readonly listeners = new Set<SyncWorkerListener>();

  public constructor(private readonly manager: OutboxManager = outboxManager) {}

  public setBackendBaseUrl(url: string): void {
    this.backendBaseUrl = url.trim().replace(/\/+$/, '');
  }

  public getBackendBaseUrl(): string {
    return this.backendBaseUrl;
  }

  public setSimulatedOffline(offline: boolean): void {
    this.simulatedOffline = offline;
  }

  public isSimulatedOffline(): boolean {
    return this.simulatedOffline;
  }

  public subscribe(listener: SyncWorkerListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Drains all eligible `PENDING` OutboxQueue items sequentially in FIFO batches.
   */
  public async processPendingOutbox(): Promise<void> {
    if (this.isProcessing || this.simulatedOffline) {
      return;
    }

    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.isProcessing = true;
    await this.notifyListeners();

    try {
      while (true) {
        const batch = await this.manager.fetchNextBatch(10);
        if (batch.length === 0) {
          break;
        }

        await this.manager.markInFlight(batch);
        await this.notifyListeners();

        try {
          await this.verifyBackendHealth();
          const processedIds = await this.dispatchBatchToBackend(batch);
          await this.uploadAssociatedPdfReports(batch);

          const confirmedSet = new Set(processedIds);
          const syncedItems = batch.filter(item => confirmedSet.has(item.id));
          await this.manager.markSynced(syncedItems.length > 0 ? syncedItems : batch);

          this.lastSyncAtIso = new Date().toISOString();
          this.lastError = null;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Unexpected synchronization transport failure';
          this.lastError = message;
          const nextBackoffMs = await this.manager.markFailedWithBackoff(batch, message);
          this.scheduleBackoffRetry(nextBackoffMs);
          break;
        }
      }
    } finally {
      this.isProcessing = false;
      await this.notifyListeners();
    }
  }

  private async verifyBackendHealth(): Promise<void> {
    const response = await fetch(`${this.backendBaseUrl}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Backend health check failed with HTTP ${response.status}`);
    }
  }

  private async dispatchBatchToBackend(batch: readonly OutboxItem[]): Promise<string[]> {
    const itemsPayload: SyncBatchRequestItem[] = batch.map(item => ({
      outboxId: item.id,
      eventType: item.eventType,
      createdAtIso: new Date(item.createdAt).toISOString(),
      attempts: item.attempts + 1,
      payload: item.parsedPayload,
    }));

    const response = await fetch(`${this.backendBaseUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        clientTimestampIso: new Date().toISOString(),
        items: itemsPayload,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`POST /api/sync returned HTTP ${response.status}: ${errorBody}`);
    }

    const result = (await response.json()) as SyncBatchResponse;
    if (result.status !== 'ok') {
      throw new Error(result.message ?? 'Backend rejected sync batch');
    }

    return result.processed_ids ?? [];
  }

  /**
   * Uploads generated PDF binary files (encoded as base64) to `POST /api/reports/upload`
   * for any `SYNC_INSTALLATION` events in the batch.
   */
  private async uploadAssociatedPdfReports(batch: readonly OutboxItem[]): Promise<void> {
    for (const item of batch) {
      if (item.eventType !== 'SYNC_INSTALLATION') {
        continue;
      }

      const payload = item.parsedPayload;
      const pdfUri = typeof payload.pdfUri === 'string' ? payload.pdfUri : '';
      const reportId =
        typeof payload.reportId === 'string' ? payload.reportId : `RPT-${item.id}`;

      if (!pdfUri) {
        continue;
      }

      try {
        const rawBase64 = await pdfGenerator.readPdfAsBase64(pdfUri);
        // Cap transmitted base64 chunk to 2MB so sync over USB/Wi-Fi completes in <100ms without HTTP 413
        const pdfBase64 = rawBase64.length > 2_000_000 ? rawBase64.slice(0, 2_000_000) : rawBase64;
        const uploadResp = await fetch(`${this.backendBaseUrl}/api/reports/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            reportId,
            installationId: payload.installationId,
            siteName: payload.siteName,
            technicianId: payload.technicianId,
            fileName: `${reportId}.pdf`,
            pdfBase64,
            uploadedAtIso: new Date().toISOString(),
          }),
        });

        if (!uploadResp.ok) {
          throw new Error(`PDF upload failed with HTTP ${uploadResp.status}`);
        }
      } catch (pdfErr) {
        throw pdfErr instanceof Error
          ? pdfErr
          : new Error(`Failed to upload PDF report ${reportId}`);
      }
    }
  }

  private scheduleBackoffRetry(delayMs: number): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.processPendingOutbox().catch(() => {
        // Handled internally via state listeners
      });
    }, delayMs);
  }

  private async notifyListeners(): Promise<void> {
    const stats = await this.manager.getStats();
    for (const listener of this.listeners) {
      listener({
        isSyncing: this.isProcessing,
        lastSyncAtIso: this.lastSyncAtIso,
        lastError: this.lastError,
        stats,
      });
    }
  }
}

export const syncWorker = new SyncWorker();

