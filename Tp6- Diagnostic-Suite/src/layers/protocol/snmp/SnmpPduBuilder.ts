import { ASN1_TAGS, SNMP_VERSION_CODES } from '../../../core/constants/oids';
import type { SnmpVersion } from '../../../core/types';
import { BerEncoder } from './BerEncoder';

export interface BuildGetRequestOptions {
  version: SnmpVersion;
  community: string;
  requestId: number;
  oids: readonly string[];
}

export interface ResponseVarBindInput {
  oid: string;
  tag: number;
  value: number | string | Uint8Array | null;
}

/**
 * Constructs RFC 1157 (SNMPv1) and RFC 1905 (SNMPv2c) Protocol Data Units (PDUs)
 * serialized in ASN.1 Basic Encoding Rules (BER).
 *
 * Frame Layout:
 * SEQUENCE (0x30)
 *  ├── version: INTEGER (0x02) -> 0 (v1) | 1 (v2c)
 *  ├── community: OCTET STRING (0x04)
 *  └── GetRequest-PDU (0xA0)
 *       ├── request-id: INTEGER (0x02)
 *       ├── error-status: INTEGER (0x02) -> 0
 *       ├── error-index: INTEGER (0x02) -> 0
 *       └── variable-bindings: SEQUENCE (0x30)
 *            └── VarBind: SEQUENCE (0x30)
 *                 ├── name: OBJECT IDENTIFIER (0x06)
 *                 └── value: NULL (0x05, 0x00)
 */
export class SnmpPduBuilder {
  /**
   * Generates a positive 31-bit random RequestID to correlate UDP requests and responses.
   */
  public static generateRequestId(): number {
    return Math.floor(100000 + Math.random() * 2147000000);
  }

  /**
   * Builds a binary SNMP GetRequest-PDU datagram for one or more MIB-II OIDs.
   */
  public static buildGetRequest(options: BuildGetRequestOptions): Uint8Array {
    const { version, community, requestId, oids } = options;
    if (oids.length === 0) {
      throw new Error('At least one OID is required to build an SNMP GetRequest PDU');
    }

    const versionCode = version === '1' ? SNMP_VERSION_CODES.V1 : SNMP_VERSION_CODES.V2C;

    // Encode each VarBind as SEQUENCE { OID, NULL }
    const encodedVarBinds = oids.map(oid =>
      BerEncoder.encodeSequence([BerEncoder.encodeOid(oid), BerEncoder.encodeNull()]),
    );

    const varBindList = BerEncoder.encodeSequence(encodedVarBinds);

    const getRequestPdu = BerEncoder.encodePdu(ASN1_TAGS.GET_REQUEST_PDU, [
      BerEncoder.encodeInteger(requestId),
      BerEncoder.encodeInteger(0), // error-status = 0 (noError)
      BerEncoder.encodeInteger(0), // error-index = 0
      varBindList,
    ]);

    return BerEncoder.encodeSequence([
      BerEncoder.encodeInteger(versionCode),
      BerEncoder.encodeOctetString(community),
      getRequestPdu,
    ]);
  }

  /**
   * Builds a binary SNMP GetResponse-PDU datagram (used for protocol verification tests
   * and loopback diagnostics).
   */
  public static buildGetResponse(params: {
    version: SnmpVersion;
    community: string;
    requestId: number;
    errorStatus?: number;
    errorIndex?: number;
    varBinds: readonly ResponseVarBindInput[];
  }): Uint8Array {
    const versionCode = params.version === '1' ? SNMP_VERSION_CODES.V1 : SNMP_VERSION_CODES.V2C;

    const encodedVarBinds = params.varBinds.map(vb => {
      let encodedVal: Uint8Array;
      switch (vb.tag) {
        case ASN1_TAGS.INTEGER:
          encodedVal = BerEncoder.encodeInteger(Number(vb.value ?? 0));
          break;
        case ASN1_TAGS.OCTET_STRING:
          encodedVal = BerEncoder.encodeOctetString(
            typeof vb.value === 'string' || vb.value instanceof Uint8Array
              ? vb.value
              : String(vb.value ?? ''),
          );
          break;
        case ASN1_TAGS.OBJECT_IDENTIFIER:
          encodedVal = BerEncoder.encodeOid(String(vb.value ?? '1.3.6.1'));
          break;
        case ASN1_TAGS.COUNTER_32:
        case ASN1_TAGS.GAUGE_32:
        case ASN1_TAGS.TIME_TICKS:
          encodedVal = BerEncoder.encodeUnsignedApplicationInt(vb.tag, Number(vb.value ?? 0));
          break;
        case ASN1_TAGS.NULL:
        default:
          encodedVal = BerEncoder.encodeNull();
          break;
      }
      return BerEncoder.encodeSequence([BerEncoder.encodeOid(vb.oid), encodedVal]);
    });

    const getResponsePdu = BerEncoder.encodePdu(ASN1_TAGS.GET_RESPONSE_PDU, [
      BerEncoder.encodeInteger(params.requestId),
      BerEncoder.encodeInteger(params.errorStatus ?? 0),
      BerEncoder.encodeInteger(params.errorIndex ?? 0),
      BerEncoder.encodeSequence(encodedVarBinds),
    ]);

    return BerEncoder.encodeSequence([
      BerEncoder.encodeInteger(versionCode),
      BerEncoder.encodeOctetString(params.community),
      getResponsePdu,
    ]);
  }
}
