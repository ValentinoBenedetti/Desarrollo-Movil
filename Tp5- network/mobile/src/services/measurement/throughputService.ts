import { ThroughputMetric } from '../../core/types/network';

export interface ThroughputConfig {
  baseUrl: string; // ej: "http://10.0.2.2:3000" para Android Emulator o IP del server
  downloadSizeMb?: number;
  uploadSizeMb?: number;
  timeoutMs?: number;
}

const getTime = (): number => {
  const g = globalThis as unknown as { performance?: { now: () => number } };
  return g.performance?.now ? g.performance.now() : Date.now();
};

export class ThroughputService {
  /**
   * Mide la tasa de transferencia de bajada (Download Throughput en Mbps).
   */
  public static async measureDownload(config: ThroughputConfig): Promise<ThroughputMetric> {
    const sizeMb = config.downloadSizeMb || 5;
    const url = `${config.baseUrl}/download?mb=${sizeMb}&t=${Date.now()}`;
    const timeoutMs = config.timeoutMs || 30000;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.timeout = timeoutMs;

      let startTime = getTime();

      xhr.onloadstart = () => {
        startTime = getTime();
      };

      xhr.onload = () => {
        const endTime = getTime();
        const durationMs = Math.max(endTime - startTime, 10);
        const durationSec = durationMs / 1000;

        let bytesTransferred = 0;
        if (xhr.response) {
          if (xhr.response instanceof ArrayBuffer) {
            bytesTransferred = xhr.response.byteLength;
          } else if (typeof xhr.response === 'string') {
            bytesTransferred = xhr.response.length;
          } else if ((xhr.response as { byteLength?: number }).byteLength) {
            bytesTransferred = (xhr.response as { byteLength: number }).byteLength;
          } else if ((xhr.response as { size?: number }).size) {
            bytesTransferred = (xhr.response as { size: number }).size;
          }
        }

        if (!bytesTransferred) {
          const headerBytes = xhr.getResponseHeader('Content-Length') || xhr.getResponseHeader('X-Payload-Bytes');
          if (headerBytes) {
            bytesTransferred = parseInt(headerBytes, 10) || 0;
          }
        }

        if (!bytesTransferred) {
          bytesTransferred = sizeMb * 1024 * 1024;
        }

        const rawSpeed = (bytesTransferred * 8) / (durationSec * 1_000_000);
        const speedMbps = isNaN(rawSpeed) || !isFinite(rawSpeed) ? 0 : parseFloat(rawSpeed.toFixed(2));

        resolve({
          direction: 'download',
          bytesTransferred,
          durationMs: parseFloat(durationMs.toFixed(2)),
          speedMbps,
          timestamp: Date.now(),
        });
      };

      xhr.onerror = () => {
        reject(new Error('Fallo en la conexión de red al ejecutar test de descarga.'));
      };

      xhr.ontimeout = () => {
        reject(new Error(`Timeout de ${timeoutMs}ms superado en test de descarga.`));
      };

      startTime = getTime();
      xhr.send();
    });
  }

  /**
   * Mide la tasa de transferencia de subida (Upload Throughput en Mbps).
   */
  public static async measureUpload(config: ThroughputConfig): Promise<ThroughputMetric> {
    const sizeMb = config.uploadSizeMb || 2; // 2MB para no saturar uplink móvil
    const url = `${config.baseUrl}/upload`;
    const timeoutMs = config.timeoutMs || 30000;
    const totalBytes = Math.floor(sizeMb * 1024 * 1024);

    // Generamos un buffer en memoria de tamaño fijo
    const payload = new Uint8Array(totalBytes);
    for (let i = 0; i < totalBytes; i += 1024) {
      payload[i] = (i % 255);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = timeoutMs;

      let startTime = getTime();

      xhr.onloadstart = () => {
        startTime = getTime();
      };

      xhr.onload = () => {
        const endTime = getTime();
        const durationMs = Math.max(endTime - startTime, 10);
        const durationSec = durationMs / 1000;

        const rawSpeed = (totalBytes * 8) / (durationSec * 1_000_000);
        const speedMbps = isNaN(rawSpeed) || !isFinite(rawSpeed) ? 0 : parseFloat(rawSpeed.toFixed(2));

        resolve({
          direction: 'upload',
          bytesTransferred: totalBytes,
          durationMs: parseFloat(durationMs.toFixed(2)),
          speedMbps,
          timestamp: Date.now(),
        });
      };

      xhr.onerror = () => {
        reject(new Error('Fallo en la conexión de red al ejecutar test de subida.'));
      };

      xhr.ontimeout = () => {
        reject(new Error(`Timeout de ${timeoutMs}ms superado en test de subida.`));
      };

      startTime = getTime();
      xhr.send(payload.buffer);
    });
  }
}
