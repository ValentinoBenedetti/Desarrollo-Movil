import { Buffer } from 'buffer';
import dgram, { UdpSocket } from 'react-native-udp';
import { ASN1_TAGS, MIB2_OIDS } from '../../../core/constants/oids';
import { BerDecoder } from './BerDecoder';
import { ResponseVarBindInput, SnmpPduBuilder } from './SnmpPduBuilder';

/**
 * Local in-device UDP ASN.1/BER SNMP responder bound to 127.0.0.1:1161 via `react-native-udp`.
 * Ensures that even when testing on a home Wi-Fi network without a physical SNMP-enabled
 * Cisco/MikroTik router, `SnmpClient` still transmits real binary BER GetRequest UDP datagrams
 * through the OS socket stack and decodes real binary GetResponse UDP datagrams.
 */
export class EmbeddedSnmpLoopback {
  public static readonly LOOPBACK_PORT = 1161;
  private socket: UdpSocket | null = null;
  private isBound = false;
  private readonly bootTimeMs = Date.now() - 48 * 3600 * 1000;
  private inOctetsCounter = 2485910200;
  private outOctetsCounter = 1394028100;

  public ensureStarted(): Promise<void> {
    if (this.isBound && this.socket) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      try {
        const sock = dgram.createSocket({ type: 'udp4' });
        sock.on('error', () => {
          this.isBound = false;
          resolve();
        });

        sock.on('message', (msg: Buffer, rinfo: { address: string; port: number }) => {
          try {
            const incomingBytes = new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength);
            const req = BerDecoder.decodeSnmpMessage(incomingBytes, 0);
            if (req.pduType !== ASN1_TAGS.GET_REQUEST_PDU) {
              return;
            }

            this.inOctetsCounter = (this.inOctetsCounter + 184320) >>> 0;
            this.outOctetsCounter = (this.outOctetsCounter + 96400) >>> 0;
            const uptimeTicks = Math.floor((Date.now() - this.bootTimeMs) / 10) >>> 0;

            const varBinds: ResponseVarBindInput[] = req.varBinds.map(vb => {
              switch (vb.oid) {
                case MIB2_OIDS.SYS_DESCR:
                  return {
                    oid: vb.oid,
                    tag: ASN1_TAGS.OCTET_STRING,
                    value: 'MikroTik RouterOS v7.15.3 CCR2004-16G-2S+ (Telecom Field Core)',
                  };
                case MIB2_OIDS.SYS_UP_TIME:
                  return {
                    oid: vb.oid,
                    tag: ASN1_TAGS.TIME_TICKS,
                    value: uptimeTicks,
                  };
                case MIB2_OIDS.SYS_NAME:
                  return {
                    oid: vb.oid,
                    tag: ASN1_TAGS.OCTET_STRING,
                    value: 'bng-core-edge01.telecom.local',
                  };
                case MIB2_OIDS.IF_IN_OCTETS_1:
                  return {
                    oid: vb.oid,
                    tag: ASN1_TAGS.COUNTER_32,
                    value: this.inOctetsCounter,
                  };
                case MIB2_OIDS.IF_OUT_OCTETS_1:
                  return {
                    oid: vb.oid,
                    tag: ASN1_TAGS.COUNTER_32,
                    value: this.outOctetsCounter,
                  };
                default:
                  return {
                    oid: vb.oid,
                    tag: ASN1_TAGS.OCTET_STRING,
                    value: `OID(${vb.oid})`,
                  };
              }
            });

            const respBytes = SnmpPduBuilder.buildGetResponse({
              version: req.version,
              community: req.community,
              requestId: req.requestId,
              errorStatus: 0,
              errorIndex: 0,
              varBinds,
            });

            const outBuf = Buffer.from(
              respBytes.buffer,
              respBytes.byteOffset,
              respBytes.byteLength,
            );
            sock.send(outBuf, 0, outBuf.length, rinfo.port, rinfo.address);
          } catch {
            // Ignore malformed packets
          }
        });

        sock.bind(EmbeddedSnmpLoopback.LOOPBACK_PORT, () => {
          this.socket = sock;
          this.isBound = true;
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }
}

export const embeddedSnmpLoopback = new EmbeddedSnmpLoopback();

