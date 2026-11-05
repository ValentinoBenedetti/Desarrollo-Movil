import cors from 'cors';
import express, { Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { LabSnmpUdpAgent } from './snmpAgent';

export interface IncomingOutboxItem {
  outboxId: string;
  eventType: 'SYNC_INSTALLATION' | 'SYNC_DIAGNOSTIC';
  createdAtIso: string;
  attempts: number;
  payload: Record<string, unknown>;
}

export interface SyncBatchRequestBody {
  clientTimestampIso?: string;
  items: IncomingOutboxItem[];
}

const STORAGE_ROOT = path.resolve(__dirname, 'storage');
const SYNC_STORAGE_DIR = path.join(STORAGE_ROOT, 'sync');
const REPORTS_STORAGE_DIR = path.join(STORAGE_ROOT, 'reports');

for (const dir of [STORAGE_ROOT, SYNC_STORAGE_DIR, REPORTS_STORAGE_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

/**
 * Validates the schema of an incoming Outbox synchronization item.
 */
function validateOutboxItem(item: unknown): {
  valid: boolean;
  reason?: string;
  parsed?: IncomingOutboxItem;
} {
  if (!item || typeof item !== 'object') {
    return { valid: false, reason: 'Item must be a non-null object' };
  }

  const candidate = item as Partial<IncomingOutboxItem>;
  if (typeof candidate.outboxId !== 'string' || !candidate.outboxId.trim()) {
    return { valid: false, reason: 'Missing or invalid outboxId' };
  }

  if (
    candidate.eventType !== 'SYNC_INSTALLATION' &&
    candidate.eventType !== 'SYNC_DIAGNOSTIC'
  ) {
    return {
      valid: false,
      reason: `Unsupported eventType: ${String(candidate.eventType)}`,
    };
  }

  if (!candidate.payload || typeof candidate.payload !== 'object') {
    return {
      valid: false,
      reason: `Missing payload object for outboxId=${candidate.outboxId}`,
    };
  }

  const payload = candidate.payload as Record<string, unknown>;
  if (candidate.eventType === 'SYNC_INSTALLATION') {
    if (
      typeof payload.siteName !== 'string' ||
      typeof payload.technicianId !== 'string' ||
      typeof payload.serialNumber !== 'string'
    ) {
      return {
        valid: false,
        reason: `SYNC_INSTALLATION item (${candidate.outboxId}) requires siteName, technicianId, and serialNumber`,
      };
    }
  } else if (candidate.eventType === 'SYNC_DIAGNOSTIC') {
    if (typeof payload.deviceIp !== 'string' && typeof payload.deviceId !== 'string') {
      return {
        valid: false,
        reason: `SYNC_DIAGNOSTIC item (${candidate.outboxId}) requires deviceIp or deviceId`,
      };
    }
  }

  return {
    valid: true,
    parsed: {
      outboxId: candidate.outboxId,
      eventType: candidate.eventType,
      createdAtIso:
        typeof candidate.createdAtIso === 'string'
          ? candidate.createdAtIso
          : new Date().toISOString(),
      attempts: typeof candidate.attempts === 'number' ? candidate.attempts : 1,
      payload,
    },
  };
}

export function createSyncApp(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '200mb' }));

  /**
   * GET /api/health
   * Link and service readiness probe consumed by the mobile SyncWorker before draining Outbox.
   */
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'network-diagnostics-backend-stub',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  /**
   * POST /api/sync
   * Validates incoming Outbox batch items (SYNC_INSTALLATION | SYNC_DIAGNOSTIC),
   * persists each validated batch as a timestamped JSON archive on disk,
   * and returns the confirmed `processed_ids`.
   */
  app.post('/api/sync', (req: Request, res: Response) => {
    const body = req.body as Partial<SyncBatchRequestBody>;
    if (!body || !Array.isArray(body.items)) {
      res.status(400).json({
        status: 'error',
        processed_ids: [],
        message: 'Request body must include an "items" array',
      });
      return;
    }

    const processedIds: string[] = [];
    const validatedItems: IncomingOutboxItem[] = [];
    const validationErrors: string[] = [];

    for (const rawItem of body.items) {
      const check = validateOutboxItem(rawItem);
      if (!check.valid || !check.parsed) {
        validationErrors.push(check.reason ?? 'Invalid item schema');
        continue;
      }
      validatedItems.push(check.parsed);
      processedIds.push(check.parsed.outboxId);
    }

    if (validatedItems.length === 0 && validationErrors.length > 0) {
      res.status(422).json({
        status: 'error',
        processed_ids: [],
        errors: validationErrors,
        message: validationErrors.join('; '),
      });
      return;
    }

    const receivedAt = new Date().toISOString();
    const safeTimestamp = receivedAt.replace(/[:.]/g, '-');
    const archiveFileName = `sync_batch_${safeTimestamp}_${processedIds.length}.json`;
    const archivePath = path.join(SYNC_STORAGE_DIR, archiveFileName);

    fs.writeFileSync(
      archivePath,
      JSON.stringify(
        {
          receivedAt,
          clientTimestampIso: body.clientTimestampIso ?? null,
          processedIds,
          items: validatedItems,
        },
        null,
        2,
      ),
      'utf8',
    );

    res.status(200).json({
      status: 'ok',
      processed_ids: processedIds,
      received_at: receivedAt,
      archive_file: archiveFileName,
    });
  });

  /**
   * POST /api/reports/upload
   * Accepts a generated field installation PDF report either via `multipart/form-data`
   * (field `file`) or via JSON `pdfBase64`, persisting the binary PDF and metadata to disk.
   */
  app.post(
    '/api/reports/upload',
    upload.single('file'),
    (req: Request, res: Response) => {
      try {
        const reportId =
          String(req.body?.reportId || `RPT-${Date.now()}`).replace(
            /[^a-zA-Z0-9_-]/g,
            '_',
          );

        let pdfBuffer: Buffer | null = null;

        if (req.file && req.file.buffer) {
          pdfBuffer = req.file.buffer;
        } else if (typeof req.body?.pdfBase64 === 'string' && req.body.pdfBase64.trim()) {
          const cleanBase64 = req.body.pdfBase64.replace(
            /^data:application\/pdf;base64,/,
            '',
          );
          pdfBuffer = Buffer.from(cleanBase64, 'base64');
        }

        if (!pdfBuffer || pdfBuffer.length === 0) {
          res.status(400).json({
            status: 'error',
            message:
              'Missing PDF payload. Provide either multipart "file" or JSON "pdfBase64".',
          });
          return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const pdfFileName = `${reportId}_${timestamp}.pdf`;
        const pdfFilePath = path.join(REPORTS_STORAGE_DIR, pdfFileName);
        fs.writeFileSync(pdfFilePath, pdfBuffer);

        const metaFilePath = path.join(
          REPORTS_STORAGE_DIR,
          `${reportId}_${timestamp}.meta.json`,
        );
        fs.writeFileSync(
          metaFilePath,
          JSON.stringify(
            {
              reportId,
              installationId: req.body?.installationId ?? null,
              siteName: req.body?.siteName ?? null,
              technicianId: req.body?.technicianId ?? null,
              pdfFileName,
              sizeBytes: pdfBuffer.length,
              archivedAtIso: new Date().toISOString(),
            },
            null,
            2,
          ),
          'utf8',
        );

        res.status(201).json({
          status: 'ok',
          report_id: reportId,
          file_name: pdfFileName,
          size_bytes: pdfBuffer.length,
          archived_at: new Date().toISOString(),
        });
      } catch (err) {
        res.status(500).json({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to archive PDF report',
        });
      }
    },
  );

  /**
   * GET /api/reports
   * Lists all synchronized JSON batches and archived PDF installation reports.
   */
  app.get('/api/reports', (_req: Request, res: Response) => {
    const syncFiles = fs
      .readdirSync(SYNC_STORAGE_DIR)
      .filter(f => f.endsWith('.json'));
    const reportFiles = fs
      .readdirSync(REPORTS_STORAGE_DIR)
      .filter(f => f.endsWith('.pdf'));

    res.status(200).json({
      status: 'ok',
      sync_batches_count: syncFiles.length,
      sync_batches: syncFiles,
      pdf_reports_count: reportFiles.length,
      pdf_reports: reportFiles,
    });
  });

  return app;
}

function getLocalLanIpv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const ifaceList of Object.values(nets)) {
    for (const addr of ifaceList ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 4600;
  const app = createSyncApp();
  const snmpAgent = new LabSnmpUdpAgent();

  const httpServer = app.listen(port, '0.0.0.0', async () => {
    const lanIps = getLocalLanIpv4Addresses();
    console.log(
      `[Network Diagnostics Backend Stub] HTTP Sync Server listening on http://0.0.0.0:${port}`,
    );
    if (lanIps.length > 0) {
      console.log(`  -> Your PC LAN IPv4(s): ${lanIps.join(', ')}`);
    }
    console.log(`  -> Health Check:  GET  http://localhost:${port}/api/health`);
    console.log(`  -> Outbox Sync:   POST http://localhost:${port}/api/sync`);
    console.log(`  -> PDF Upload:    POST http://localhost:${port}/api/reports/upload`);
    console.log(`  -> Archive List:  GET  http://localhost:${port}/api/reports`);

    try {
      const handle = await snmpAgent.start(161, 1161);
      console.log(
        `[SNMP UDP Agent] Listening for binary ASN.1/BER GetRequests on UDP port ${handle.port}`,
      );
      if (lanIps.length > 0) {
        console.log(
          `  -> Target this IP from the mobile app (Discovery / Diagnostic): ${lanIps[0]}:${handle.port}/udp (community: "public")`,
        );
      }
    } catch (err) {
      console.warn('[SNMP UDP Agent] Failed to bind UDP socket:', err);
    }
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(
        `[Network Diagnostics Backend Stub] Port ${port} is already active and listening! You do not need to start a second instance.`,
      );
      process.exit(0);
    }
    throw err;
  });
}

