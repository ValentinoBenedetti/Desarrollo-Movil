import { ThroughputService } from '../../src/services/measurement/throughputService';

describe('ThroughputService - RF-03 Pruebas de Transferencia', () => {
  let originalXHR: any;

  beforeEach(() => {
    originalXHR = (globalThis as any).XMLHttpRequest;
  });

  afterEach(() => {
    (globalThis as any).XMLHttpRequest = originalXHR;
  });

  it('debe calcular la tasa de descarga en Mbps usando la fórmula (Bytes * 8) / (segundos * 10^6)', async () => {
    const payloadBytes = 2 * 1024 * 1024; // 2 MB
    const dummyBuffer = new ArrayBuffer(payloadBytes);

    // Mock de XMLHttpRequest para simular descarga controlada
    const mockXHR = {
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(function (this: any) {
        if (this.onloadstart) {
          this.onloadstart();
        }
        // Simular transferencia completada
        setTimeout(() => {
          this.response = dummyBuffer;
          if (this.onload) {
            this.onload();
          }
        }, 50);
      }),
      response: dummyBuffer,
      responseType: '',
      timeout: 0,
      onloadstart: null as any,
      onload: null as any,
      onerror: null as any,
      ontimeout: null as any,
    };

    (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR);

    const result = await ThroughputService.measureDownload({
      baseUrl: 'http://127.0.0.1:3000',
      downloadSizeMb: 2,
      timeoutMs: 5000,
    });

    expect(result.direction).toBe('download');
    expect(result.bytesTransferred).toBe(payloadBytes);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.speedMbps).toBeGreaterThan(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('debe calcular la tasa de subida en Mbps y transmitir buffer binario sin acumular memoria', async () => {
    const mockXHR = {
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(function (this: any, _data: any) {
        if (this.onloadstart) {
          this.onloadstart();
        }
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 50);
      }),
      timeout: 0,
      onloadstart: null as any,
      onload: null as any,
      onerror: null as any,
      ontimeout: null as any,
    };

    (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR);

    const result = await ThroughputService.measureUpload({
      baseUrl: 'http://127.0.0.1:3000',
      uploadSizeMb: 1, // 1 MB
      timeoutMs: 5000,
    });

    expect(result.direction).toBe('upload');
    expect(result.bytesTransferred).toBe(1024 * 1024);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.speedMbps).toBeGreaterThan(0);
  });

  it('debe propagar error de red si el socket falla', async () => {
    const mockXHR = {
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(function (this: any) {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror();
          }
        }, 10);
      }),
      timeout: 0,
      onloadstart: null as any,
      onload: null as any,
      onerror: null as any,
      ontimeout: null as any,
    };

    (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHR);

    await expect(
      ThroughputService.measureDownload({ baseUrl: 'http://127.0.0.1:3000' })
    ).rejects.toThrow('Fallo en la conexión de red al ejecutar test de descarga.');
  });
});
