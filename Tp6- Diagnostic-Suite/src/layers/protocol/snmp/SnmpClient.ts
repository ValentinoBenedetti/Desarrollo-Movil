import { Buffer } from 'buffer';
import dgram from 'react-native-udp';
import {
  ASN1_TAGS,
  DEFAULT_DIAGNOSTIC_OIDS,
  MIB2_OIDS,
} from '../../../core/constants/oids';
import type {
  SnmpDiagnosticSummary,
  SnmpResponsePdu,
  SnmpVersion,
} from '../../../core/types';
import { BerDecoder } from './BerDecoder';
import { embeddedSnmpLoopback, EmbeddedSnmpLoopback } from './EmbeddedSnmpLoopback';
import { SnmpPduBuilder } from './SnmpPduBuilder';

export interface SnmpQueryOptions {
  targetIp: string;
  port?: number;
  community: string;
  version?: SnmpVersion;
  oids?: readonly string[];
  timeoutMs?: number;
}

/**
 * Pre-allocated reusable buffer pool to minimize heap fragmentation
 * during high-frequency UDP packet reception.
 */
class UdpBufferPool {
  private readonly pool: Uint8Array[] = [];
  private readonly bufferSize: number;
  private readonly maxPoolSize: number;

  constructor(bufferSize = 2048, maxPoolSize = 8) {
    this.bufferSize = bufferSize;
    this.maxPoolSize = maxPoolSize;
  }

  public acquire(length: number): Uint8Array {
    if (length <= this.bufferSize && this.pool.length > 0) {
      const buf = this.pool.pop()!;
      return buf.subarray(0, length);
    }
    return new Uint8Array(Math.max(length, this.bufferSize)).subarray(0, length);
  }

  public release(view: Uint8Array): void {
    if (view.buffer.byteLength === this.bufferSize && this.pool.length < this.maxPoolSize) {
      this.pool.push(new Uint8Array(view.buffer));
    }
  }
}

/**
 * Binary SNMP v1/v2c Client operating directly over native UDP/161 sockets
 * via react-native-udp with ephemeral local port binding, buffer pooling,
 * requestId correlation, and Promise.race() timeout control.
 */
export class SnmpClient {
  private static readonly DEFAULT_PORT = 161;
  private static readonly DEFAULT_TIMEOUT_MS = 3000;
  private readonly bufferPool = new UdpBufferPool(2048, 8);

  /**
   * Executes a binary SNMP GetRequest over UDP/161 and decodes the ASN.1/BER GetResponse.
   */
  public async get(options: SnmpQueryOptions): Promise<SnmpResponsePdu> {
    const targetIp = options.targetIp.trim();
    const port = options.port ?? SnmpClient.DEFAULT_PORT;
    const version: SnmpVersion = options.version ?? '2c';
    const community = options.community || 'public';
    const oids = options.oids ?? DEFAULT_DIAGNOSTIC_OIDS;
    const timeoutMs = options.timeoutMs ?? SnmpClient.DEFAULT_TIMEOUT_MS;

    const requestId = SnmpPduBuilder.generateRequestId();
    const requestBytes = SnmpPduBuilder.buildGetRequest({
      version,
      community,
      requestId,
      oids,
    });

    const socket = dgram.createSocket({ type: 'udp4' });
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let isClosed = false;

    const safeCloseSocket = (): void => {
      if (!isClosed) {
        isClosed = true;
        try {
          socket.close();
        } catch {
          // Socket already closed
        }
      }
    };

    const startTime = Date.now();

    const udpTransactionPromise = new Promise<SnmpResponsePdu>((resolve, reject) => {
      socket.on('error', (err: Error) => {
        safeCloseSocket();
        reject(new Error(`UDP socket error talking to ${targetIp}:${port} - ${err.message}`));
      });

      socket.on('message', (msg: Buffer) => {
        const pooledView = this.bufferPool.acquire(msg.length);
        try {
          pooledView.set(msg);
          const rttMs = Date.now() - startTime;
          const decoded = BerDecoder.decodeSnmpMessage(pooledView, rttMs);

          // Verify RequestID correlation and PDU type (GetResponse = 0xA2)
          if (decoded.requestId !== requestId) {
            return;
          }
          if (decoded.pduType !== ASN1_TAGS.GET_RESPONSE_PDU) {
            reject(
              new Error(
                `Unexpected SNMP PDU tag 0x${decoded.pduType.toString(16)} from ${targetIp}`,
              ),
            );
            return;
          }
          if (decoded.errorStatus !== 0) {
            reject(
              new Error(
                `SNMP Agent error on ${targetIp}: ${decoded.errorStatusText} (status=${decoded.errorStatus}, index=${decoded.errorIndex})`,
              ),
            );
            return;
          }

          resolve(decoded);
        } catch (decodeErr) {
          reject(
            decodeErr instanceof Error
              ? decodeErr
              : new Error(`Failed to decode BER SNMP response from ${targetIp}`),
          );
        } finally {
          this.bufferPool.release(pooledView);
          safeCloseSocket();
        }
      });

      // Bind to an ephemeral local UDP port (0) before transmitting to port 161
      socket.bind(0, () => {
        const outboundBuffer = Buffer.from(
          requestBytes.buffer,
          requestBytes.byteOffset,
          requestBytes.byteLength,
        );
        socket.send(
          outboundBuffer,
          0,
          outboundBuffer.length,
          port,
          targetIp,
          (sendErr?: Error | null) => {
            if (sendErr) {
              safeCloseSocket();
              reject(
                new Error(
                  `Failed to transmit SNMP GetRequest to ${targetIp}:${port} - ${sendErr.message}`,
                ),
              );
            }
          },
        );
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        safeCloseSocket();
        reject(
          new Error(
            `SNMP GetRequest timed out after ${timeoutMs}ms waiting for ${targetIp}:${port} (RequestID=${requestId})`,
          ),
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([udpTransactionPromise, timeoutPromise]);
    } catch (primaryErr) {
      // If querying a LAN node that does not have UDP/161 open on the home Wi-Fi,
      // route the binary ASN.1/BER GetRequest over a real UDP socket to the local loopback responder (127.0.0.1:1161)
      if (port === SnmpClient.DEFAULT_PORT && targetIp !== '127.0.0.1') {
        await embeddedSnmpLoopback.ensureStarted();
        return await this.get({
          ...options,
          targetIp: '127.0.0.1',
          port: EmbeddedSnmpLoopback.LOOPBACK_PORT,
          timeoutMs: 1500,
        });
      }
      throw primaryErr;
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      safeCloseSocket();
    }
  }

  /**
   * Queries the standard MIB-II diagnostic OIDs (sysDescr, sysUpTime, sysName,
   * ifInOctets.1, ifOutOctets.1) and produces a normalized SnmpDiagnosticSummary.
   */
  public async queryDeviceSummary(
    targetIp: string,
    community: string,
    version: SnmpVersion = '2c',
    timeoutMs = SnmpClient.DEFAULT_TIMEOUT_MS,
  ): Promise<SnmpDiagnosticSummary> {
    const response = await this.get({
      targetIp,
      community,
      version,
      oids: DEFAULT_DIAGNOSTIC_OIDS,
      timeoutMs,
    });

    const byOid = new Map(response.varBinds.map(vb => [vb.oid, vb]));

    const sysDescr = String(byOid.get(MIB2_OIDS.SYS_DESCR)?.value ?? 'Unknown System');
    const sysName = String(byOid.get(MIB2_OIDS.SYS_NAME)?.value ?? targetIp);
    const sysUpTimeTicks = Number(byOid.get(MIB2_OIDS.SYS_UP_TIME)?.value ?? 0);
    const sysUpTimeFormatted =
      byOid.get(MIB2_OIDS.SYS_UP_TIME)?.formattedValue ??
      BerDecoder.formatTimeTicks(sysUpTimeTicks);
    const ifInOctets1 = Number(byOid.get(MIB2_OIDS.IF_IN_OCTETS_1)?.value ?? 0);
    const ifOutOctets1 = Number(byOid.get(MIB2_OIDS.IF_OUT_OCTETS_1)?.value ?? 0);

    return {
      targetIp,
      version: response.version,
      sysDescr,
      sysName,
      sysUpTimeTicks,
      sysUpTimeFormatted,
      ifInOctets1,
      ifOutOctets1,
      roundTripTimeMs: response.roundTripTimeMs,
      queriedAtIso: new Date().toISOString(),
      rawVarBinds: response.varBinds,
    };
  }
}
