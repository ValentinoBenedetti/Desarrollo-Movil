import TcpSocket from 'react-native-tcp-socket';
import { LatencyMetric } from '../../core/types/network';

export interface PingHostConfig {
  name: string;
  host: string;
  port: number;
}

export const DEFAULT_PING_HOSTS: PingHostConfig[] = [
  { name: 'Google DNS', host: '8.8.8.8', port: 53 },
  { name: 'Cloudflare DNS', host: '1.1.1.1', port: 53 },
  { name: 'QoS Local Server', host: '10.0.2.2', port: 3001 }, // 10.0.2.2 es localhost en el emulador Android
];

const getTime = (): number => {
  const g = globalThis as unknown as { performance?: { now: () => number } };
  return g.performance?.now ? g.performance.now() : Date.now();
};

export class TcpPingService {
  /**
   * Mide la latencia RTT sobre socket TCP (3-way handshake o echo).
   * Ejecuta múltiples muestras y calcula min, avg, max, jitter RFC 3550 y packet loss.
   */
  public static async runPingTest(
    target: PingHostConfig,
    sampleCount: number = 5,
    timeoutMs: number = 3000
  ): Promise<LatencyMetric> {
    const samples: number[] = [];
    let lostPackets = 0;

    for (let i = 0; i < sampleCount; i++) {
      try {
        const rtt = await this.singleProbe(target.host, target.port, timeoutMs);
        samples.push(rtt);
      } catch {
        lostPackets++;
      }

      // Pequeño espaciado entre sondas (100ms) para no saturar la cola de red
      if (i < sampleCount - 1) {
        await new Promise((resolve) => setTimeout(() => resolve(null), 100));
      }
    }

    const packetLossPercent = (lostPackets / sampleCount) * 100;

    if (samples.length === 0) {
      return {
        host: target.name,
        minMs: 0,
        avgMs: 0,
        maxMs: 0,
        jitterMs: 0,
        packetLossPercent: 100,
        samples: [],
        timestamp: Date.now(),
      };
    }

    const minMs = Math.min(...samples);
    const maxMs = Math.max(...samples);
    const avgMs = samples.reduce((acc, curr) => acc + curr, 0) / samples.length;

    // Cálculo de Jitter según estándar RFC 3550
    // Jitter = Promedio de las diferencias absolutas entre RTTs consecutivos
    let jitterMs = 0;
    if (samples.length > 1) {
      let diffSum = 0;
      for (let j = 1; j < samples.length; j++) {
        diffSum += Math.abs(samples[j] - samples[j - 1]);
      }
      jitterMs = diffSum / (samples.length - 1);
    }

    return {
      host: target.name,
      minMs: parseFloat(minMs.toFixed(2)),
      avgMs: parseFloat(avgMs.toFixed(2)),
      maxMs: parseFloat(maxMs.toFixed(2)),
      jitterMs: parseFloat(jitterMs.toFixed(2)),
      packetLossPercent: parseFloat(packetLossPercent.toFixed(1)),
      samples,
      timestamp: Date.now(),
    };
  }

  /**
   * Ejecuta una sonda individual midiendo el tiempo de conexión TCP completa (SYN -> SYN-ACK -> ACK).
   */
  private static singleProbe(
    host: string,
    port: number,
    timeoutMs: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = getTime();
      let resolved = false;

      const client = TcpSocket.createConnection(
        {
          host,
          port,
        },
        () => {
          if (!resolved) {
            resolved = true;
            const rtt = getTime() - startTime;
            client.destroy();
            resolve(rtt);
          }
        }
      );

      client.setTimeout(timeoutMs);

      client.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          client.destroy();
          reject(new Error(`Timeout de ${timeoutMs}ms alcanzado al conectar con ${host}:${port}`));
        }
      });

      client.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          client.destroy();
          reject(err);
        }
      });
    });
  }
}
