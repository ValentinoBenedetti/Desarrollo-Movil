import { TcpPingService, DEFAULT_PING_HOSTS } from '../../src/services/measurement/tcpPingService';
import TcpSocket from 'react-native-tcp-socket';

describe('TcpPingService - RF-02 Sondas de Latencia y Jitter RFC 3550', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe contener hosts predeterminados válidos (Google DNS, Cloudflare, Backend QoS)', () => {
    expect(DEFAULT_PING_HOSTS.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_PING_HOSTS.find((h) => h.host === '8.8.8.8')).toBeDefined();
    expect(DEFAULT_PING_HOSTS.find((h) => h.host === '1.1.1.1')).toBeDefined();
  });

  it('debe calcular métricas de latencia y jitter correctamente en sondas exitosas', async () => {
    const result = await TcpPingService.runPingTest(
      { name: 'Test Host', host: '127.0.0.1', port: 3001 },
      3,
      1000
    );

    expect(result.host).toBe('Test Host');
    expect(result.samples.length).toBe(3);
    expect(result.packetLossPercent).toBe(0);
    expect(result.minMs).toBeGreaterThanOrEqual(0);
    expect(result.maxMs).toBeGreaterThanOrEqual(result.minMs);
    expect(result.avgMs).toBeGreaterThanOrEqual(result.minMs);
    expect(result.jitterMs).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('debe registrar 100% de pérdida de paquetes cuando todas las conexiones fallan por timeout', async () => {
    // Forzamos fallo por error o timeout en TcpSocket
    const createConnectionSpy = jest.spyOn(TcpSocket, 'createConnection').mockImplementation((_options, _callback) => {
      const EventEmitter = require('events');
      const emitter = new EventEmitter();
      emitter.destroy = jest.fn();
      emitter.setTimeout = jest.fn();
      // Disparamos timeout
      setTimeout(() => {
        emitter.emit('timeout');
      }, 5);
      return emitter as any;
    });

    const result = await TcpPingService.runPingTest(
      { name: 'Unreachable Host', host: '192.0.2.1', port: 9999 },
      2,
      50
    );

    expect(result.packetLossPercent).toBe(100);
    expect(result.samples).toHaveLength(0);
    expect(result.avgMs).toBe(0);
    expect(result.minMs).toBe(0);
    expect(result.maxMs).toBe(0);
    expect(result.jitterMs).toBe(0);

    createConnectionSpy.mockRestore();
  });

  it('debe calcular el Jitter RFC 3550 matemáticamente exacto entre muestras consecutivas', async () => {
    // Sondas simuladas con tiempos conocidos: 20ms, 40ms, 30ms
    // Diferencias: |40 - 20| = 20, |30 - 40| = 10 -> Suma = 30 / (3 - 1) = 15.0 ms
    const delays = [20, 40, 30];
    let probeIndex = 0;

    const singleProbeSpy = jest.spyOn(TcpPingService as any, 'singleProbe').mockImplementation(() => {
      const delay = delays[probeIndex++];
      return Promise.resolve(delay);
    });

    const result = await TcpPingService.runPingTest(
      { name: 'Jitter Test', host: '10.0.0.1', port: 80 },
      3,
      1000
    );

    expect(result.minMs).toBe(20);
    expect(result.maxMs).toBe(40);
    expect(result.avgMs).toBe(30);
    expect(result.jitterMs).toBe(15);
    expect(result.packetLossPercent).toBe(0);

    singleProbeSpy.mockRestore();
  });
});
