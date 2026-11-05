import dgram from 'node:dgram';
import os from 'node:os';
import {
  ASN1_TAGS,
  MIB2_OIDS,
} from '../../src/core/constants/oids';
import { BerDecoder } from '../../src/layers/protocol/snmp/BerDecoder';
import {
  SnmpPduBuilder,
  type ResponseVarBindInput,
} from '../../src/layers/protocol/snmp/SnmpPduBuilder';

export interface SnmpAgentHandle {
  port: number;
  close: () => Promise<void>;
}

/**
 * Real UDP Binary SNMP v1/v2c Agent Responder (RFC 1157 / RFC 1905).
 * Listens on UDP/161 (or a custom port), decodes incoming ASN.1/BER GetRequest PDUs,
 * and replies with binary ASN.1/BER GetResponse PDUs containing live MIB-II telemetry.
 */
export class LabSnmpUdpAgent {
  private socket: dgram.Socket | null = null;
  private readonly startTimestampMs = Date.now() - 36 * 3600 * 1000; // Base 36h uptime + live delta
  private baseInOctets = 1482910400;
  private baseOutOctets = 892341200;

  /**
   * Starts the UDP SNMP agent on `preferredPort` (defaults to 161).
   * If port 161 is unavailable due to OS privileges, automatically falls back to `fallbackPort` (1161).
   */
  public async start(
    preferredPort = Number(process.env.SNMP_PORT) || 161,
    fallbackPort = 1161,
  ): Promise<SnmpAgentHandle> {
    try {
      return await this.bindOnPort(preferredPort);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code === 'EACCES' || code === 'EADDRINUSE') && preferredPort !== fallbackPort) {
        console.warn(
          `[SNMP UDP Agent] Port ${preferredPort}/udp unavailable (${code}). Falling back to ${fallbackPort}/udp.`,
        );
        return await this.bindOnPort(fallbackPort);
      }
      throw err;
    }
  }

  private bindOnPort(port: number): Promise<SnmpAgentHandle> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      let bound = false;

      socket.once('error', (err: Error) => {
        if (!bound) {
          try {
            socket.close();
          } catch {
            // Ignore
          }
          reject(err);
        }
      });

      socket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        this.handleIncomingDatagram(socket, msg, rinfo);
      });

      socket.bind(port, '0.0.0.0', () => {
        bound = true;
        this.socket = socket;
        const address = socket.address();
        const actualPort = typeof address === 'object' ? address.port : port;
        resolve({
          port: actualPort,
          close: () =>
            new Promise<void>(res => {
              try {
                socket.close(() => res());
              } catch {
                res();
              }
            }),
        });
      });
    });
  }

  private handleIncomingDatagram(
    socket: dgram.Socket,
    msg: Buffer,
    rinfo: dgram.RemoteInfo,
  ): void {
    try {
      const incomingBytes = new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength);
      const requestPdu = BerDecoder.decodeSnmpMessage(incomingBytes, 0);

      if (
        requestPdu.pduType !== ASN1_TAGS.GET_REQUEST_PDU &&
        requestPdu.pduType !== ASN1_TAGS.GET_NEXT_REQUEST_PDU
      ) {
        return;
      }

      // Advance simulated traffic counters dynamically with elapsed time + packet size
      this.baseInOctets = (this.baseInOctets + msg.length * 1024 + 45000) >>> 0;
      this.baseOutOctets = (this.baseOutOctets + msg.length * 768 + 28000) >>> 0;

      const elapsedHundredths = Math.floor((Date.now() - this.startTimestampMs) / 10) >>> 0;
      const responseVarBinds: ResponseVarBindInput[] = requestPdu.varBinds.map(vb =>
        this.resolveMib2Oid(vb.oid, elapsedHundredths),
      );

      const responseDatagram = SnmpPduBuilder.buildGetResponse({
        version: requestPdu.version,
        community: requestPdu.community,
        requestId: requestPdu.requestId,
        errorStatus: 0,
        errorIndex: 0,
        varBinds: responseVarBinds,
      });

      const outboundBuffer = Buffer.from(
        responseDatagram.buffer,
        responseDatagram.byteOffset,
        responseDatagram.byteLength,
      );

      socket.send(outboundBuffer, 0, outboundBuffer.length, rinfo.port, rinfo.address);
      console.log(
        `[SNMP UDP Agent] Responded to GetRequest (reqId=${requestPdu.requestId}, v${requestPdu.version}, ${responseVarBinds.length} OIDs) from ${rinfo.address}:${rinfo.port}`,
      );
    } catch (err) {
      console.warn(
        `[SNMP UDP Agent] Ignored malformed UDP packet from ${rinfo.address}:${rinfo.port}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  private resolveMib2Oid(oid: string, uptimeTicks: number): ResponseVarBindInput {
    switch (oid) {
      case MIB2_OIDS.SYS_DESCR:
        return {
          oid,
          tag: ASN1_TAGS.OCTET_STRING,
          value: 'MikroTik RouterOS v7.15.3 (CCR2004-16G-2S+ Lab Telecom Node - FCyT UADER)',
        };
      case MIB2_OIDS.SYS_OBJECT_ID:
        return {
          oid,
          tag: ASN1_TAGS.OBJECT_IDENTIFIER,
          value: '1.3.6.1.4.1.14988.1',
        };
      case MIB2_OIDS.SYS_UP_TIME:
        return {
          oid,
          tag: ASN1_TAGS.TIME_TICKS,
          value: uptimeTicks,
        };
      case MIB2_OIDS.SYS_NAME:
        return {
          oid,
          tag: ASN1_TAGS.OCTET_STRING,
          value: `${os.hostname().toLowerCase()}.telecom.fcyt.local`,
        };
      case MIB2_OIDS.IF_IN_OCTETS_1:
        return {
          oid,
          tag: ASN1_TAGS.COUNTER_32,
          value: this.baseInOctets,
        };
      case MIB2_OIDS.IF_OUT_OCTETS_1:
        return {
          oid,
          tag: ASN1_TAGS.COUNTER_32,
          value: this.baseOutOctets,
        };
      default:
        return {
          oid,
          tag: ASN1_TAGS.OCTET_STRING,
          value: `MIB-II-Value(${oid})`,
        };
    }
  }
}
