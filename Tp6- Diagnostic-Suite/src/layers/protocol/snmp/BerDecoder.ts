import {
  ASN1_TAGS,
  OID_LABELS,
  SNMP_ERROR_STATUS_LABELS,
  SNMP_VERSION_CODES,
} from '../../../core/constants/oids';
import type {
  BerDecodedNode,
  SnmpResponsePdu,
  SnmpVarBind,
  SnmpVersion,
} from '../../../core/types';

/**
 * Low-level ASN.1 Basic Encoding Rules (BER) Binary Decoder (ITU-T X.690).
 * Parses raw UDP datagrams from port 161 into strongly-typed SNMP v1/v2c structures.
 */
export class BerDecoder {
  /**
   * Reads a BER definite-length field starting at `offset`.
   * Returns both the decoded content length and the number of octets consumed by the length field.
   */
  public static readLength(
    buffer: Uint8Array,
    offset: number,
  ): { length: number; lengthBytesConsumed: number } {
    if (offset >= buffer.length) {
      throw new RangeError(
        `Unexpected EOF while reading BER length at offset ${offset} (buffer size ${buffer.length})`,
      );
    }

    const firstByte = buffer[offset];
    if ((firstByte & 0x80) === 0) {
      // Short form: bits 0..6 directly encode length (0..127)
      return { length: firstByte, lengthBytesConsumed: 1 };
    }

    const numOctets = firstByte & 0x7f;
    if (numOctets === 0) {
      throw new Error('BER indefinite length (0x80) is not permitted in SNMP PDUs');
    }
    if (numOctets > 4) {
      throw new Error(`BER length field exceeds 32-bit bounds (${numOctets} octets)`);
    }
    if (offset + 1 + numOctets > buffer.length) {
      throw new RangeError(
        `Truncated BER long-form length at offset ${offset}: needed ${numOctets} bytes`,
      );
    }

    let length = 0;
    for (let i = 0; i < numOctets; i++) {
      length = length * 256 + buffer[offset + 1 + i];
    }

    return { length, lengthBytesConsumed: 1 + numOctets };
  }

  /**
   * Decodes a single TLV element at `offset` and recursively parses child elements
   * for SEQUENCE (0x30) and SNMP PDU constructed tags (0xA0..0xA5).
   */
  public static decodeTlv(buffer: Uint8Array, offset = 0): BerDecodedNode {
    if (offset >= buffer.length) {
      throw new RangeError(`Cannot decode TLV at offset ${offset}: buffer length is ${buffer.length}`);
    }

    const tag = buffer[offset];
    const { length, lengthBytesConsumed } = BerDecoder.readLength(buffer, offset + 1);
    const valueOffset = offset + 1 + lengthBytesConsumed;
    const endOffset = valueOffset + length;

    if (endOffset > buffer.length) {
      throw new RangeError(
        `Truncated BER value for tag 0x${tag.toString(16)}: expected ${length} bytes at offset ${valueOffset}, available ${buffer.length - valueOffset}`,
      );
    }

    const rawBytes = buffer.subarray(valueOffset, endOffset);
    const totalByteLength = 1 + lengthBytesConsumed + length;

    const isConstructed =
      tag === ASN1_TAGS.SEQUENCE ||
      tag === ASN1_TAGS.GET_REQUEST_PDU ||
      tag === ASN1_TAGS.GET_NEXT_REQUEST_PDU ||
      tag === ASN1_TAGS.GET_RESPONSE_PDU ||
      tag === ASN1_TAGS.SET_REQUEST_PDU ||
      tag === ASN1_TAGS.GET_BULK_REQUEST_PDU;

    if (!isConstructed) {
      return {
        tag,
        length,
        valueOffset,
        totalByteLength,
        rawBytes,
      };
    }

    const children: BerDecodedNode[] = [];
    let childCursor = valueOffset;
    while (childCursor < endOffset) {
      const child = BerDecoder.decodeTlv(buffer, childCursor);
      children.push(child);
      childCursor += child.totalByteLength;
    }

    return {
      tag,
      length,
      valueOffset,
      totalByteLength,
      rawBytes,
      children,
    };
  }

  /**
   * Decodes a signed two's complement ASN.1 INTEGER (Tag 0x02).
   */
  public static decodeInteger(bytes: Uint8Array): number {
    if (bytes.length === 0) {
      return 0;
    }

    const isNegative = (bytes[0] & 0x80) !== 0;
    let value = 0;
    for (let i = 0; i < bytes.length; i++) {
      value = value * 256 + bytes[i];
    }

    if (isNegative) {
      value -= Math.pow(256, bytes.length);
    }

    return value;
  }

  /**
   * Decodes an unsigned 32-bit application integer (Counter32 0x41, Gauge32 0x42, TimeTicks 0x43).
   */
  public static decodeUnsigned32(bytes: Uint8Array): number {
    let value = 0;
    for (let i = 0; i < bytes.length; i++) {
      value = value * 256 + bytes[i];
    }
    return value;
  }

  /**
   * Decodes an OCTET STRING (Tag 0x04). If all bytes are printable ASCII/UTF-8 or whitespace,
   * returns a decoded string; otherwise formats as a colon-delimited hexadecimal MAC/binary string.
   */
  public static decodeOctetString(bytes: Uint8Array): string {
    if (bytes.length === 0) {
      return '';
    }

    let isPrintable = true;
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
        isPrintable = false;
        break;
      }
      if (b === 0x7f) {
        isPrintable = false;
        break;
      }
    }

    if (!isPrintable) {
      return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
    }

    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b0 = bytes[i++];
      if (b0 < 0x80) {
        out += String.fromCharCode(b0);
      } else if ((b0 & 0xe0) === 0xc0 && i < bytes.length) {
        const b1 = bytes[i++] & 0x3f;
        out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
      } else if ((b0 & 0xf0) === 0xe0 && i + 1 < bytes.length) {
        const b1 = bytes[i++] & 0x3f;
        const b2 = bytes[i++] & 0x3f;
        out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
      } else {
        out += String.fromCharCode(b0);
      }
    }
    return out;
  }

  /**
   * Decodes an ASN.1 OBJECT IDENTIFIER (Tag 0x06) into dotted-decimal notation (e.g. "1.3.6.1.2.1.1.1.0").
   */
  public static decodeOid(bytes: Uint8Array): string {
    if (bytes.length === 0) {
      throw new Error('Cannot decode empty OBJECT IDENTIFIER');
    }

    // Read first VLQ sub-identifier and split into first two OID arcs
    let offset = 0;
    let firstSubId = 0;
    while (offset < bytes.length) {
      const byte = bytes[offset++];
      firstSubId = firstSubId * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) {
        break;
      }
    }

    const arc0 = firstSubId < 80 ? Math.floor(firstSubId / 40) : 2;
    const arc1 = firstSubId - arc0 * 40;
    const arcs: number[] = [arc0, arc1];

    let currentArc = 0;
    let inProgress = false;
    while (offset < bytes.length) {
      const byte = bytes[offset++];
      currentArc = currentArc * 128 + (byte & 0x7f);
      inProgress = true;
      if ((byte & 0x80) === 0) {
        arcs.push(currentArc);
        currentArc = 0;
        inProgress = false;
      }
    }

    if (inProgress) {
      throw new Error('Malformed OID: unterminated base-128 sub-identifier');
    }

    return arcs.join('.');
  }

  /**
   * Formats SNMP TimeTicks (hundredths of a second) into human-readable uptime.
   */
  public static formatTimeTicks(ticks: number): string {
    const totalSeconds = Math.floor(ticks / 100);
    const hundredths = ticks % 100;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${days}d ${hours}h ${minutes}m ${seconds}.${hundredths.toString().padStart(2, '0')}s (${ticks} ticks)`;
  }

  /**
   * Decodes a complete SNMP v1/v2c Message (GetResponse-PDU or GetRequest-PDU) from a UDP datagram.
   */
  public static decodeSnmpMessage(
    datagram: Uint8Array,
    roundTripTimeMs = 0,
  ): SnmpResponsePdu {
    const root = BerDecoder.decodeTlv(datagram, 0);
    if (root.tag !== ASN1_TAGS.SEQUENCE || !root.children || root.children.length < 3) {
      throw new Error(
        `Invalid SNMP outer envelope: expected SEQUENCE (0x30) with 3 children, got tag 0x${root.tag.toString(16)}`,
      );
    }

    const [versionNode, communityNode, pduNode] = root.children;
    if (versionNode.tag !== ASN1_TAGS.INTEGER) {
      throw new Error(`Invalid SNMP version tag: 0x${versionNode.tag.toString(16)}`);
    }
    if (communityNode.tag !== ASN1_TAGS.OCTET_STRING) {
      throw new Error(`Invalid SNMP community string tag: 0x${communityNode.tag.toString(16)}`);
    }

    const versionRaw = BerDecoder.decodeInteger(versionNode.rawBytes);
    const version: SnmpVersion = versionRaw === SNMP_VERSION_CODES.V1 ? '1' : '2c';
    const community = BerDecoder.decodeOctetString(communityNode.rawBytes);

    if (!pduNode.children || pduNode.children.length < 4) {
      throw new Error(
        `Invalid SNMP PDU structure (tag 0x${pduNode.tag.toString(16)}): expected 4 fields`,
      );
    }

    const [reqIdNode, errStatusNode, errIndexNode, varBindListNode] = pduNode.children;
    const requestId = BerDecoder.decodeInteger(reqIdNode.rawBytes);
    const errorStatus = BerDecoder.decodeInteger(errStatusNode.rawBytes);
    const errorIndex = BerDecoder.decodeInteger(errIndexNode.rawBytes);
    const errorStatusText = SNMP_ERROR_STATUS_LABELS[errorStatus] ?? `unknownError(${errorStatus})`;

    if (varBindListNode.tag !== ASN1_TAGS.SEQUENCE) {
      throw new Error(
        `Invalid VarBindList tag: expected 0x30, got 0x${varBindListNode.tag.toString(16)}`,
      );
    }

    const varBinds: SnmpVarBind[] = [];
    for (const varBindSeq of varBindListNode.children ?? []) {
      if (
        varBindSeq.tag !== ASN1_TAGS.SEQUENCE ||
        !varBindSeq.children ||
        varBindSeq.children.length < 2
      ) {
        continue;
      }

      const [oidNode, valNode] = varBindSeq.children;
      if (oidNode.tag !== ASN1_TAGS.OBJECT_IDENTIFIER) {
        continue;
      }

      const oid = BerDecoder.decodeOid(oidNode.rawBytes);
      const label = OID_LABELS[oid] ?? oid;
      const parsedVal = BerDecoder.decodeVarBindValue(valNode);

      varBinds.push({
        oid,
        label,
        tag: valNode.tag,
        typeName: parsedVal.typeName,
        value: parsedVal.value,
        formattedValue: parsedVal.formattedValue,
      });
    }

    return {
      version,
      community,
      pduType: pduNode.tag,
      requestId,
      errorStatus,
      errorStatusText,
      errorIndex,
      varBinds,
      roundTripTimeMs,
    };
  }

  /**
   * Decodes the value part of a single VarBind according to its ASN.1 / SMI tag.
   */
  private static decodeVarBindValue(node: BerDecodedNode): {
    typeName: SnmpVarBind['typeName'];
    value: string | number | null;
    formattedValue: string;
  } {
    switch (node.tag) {
      case ASN1_TAGS.INTEGER: {
        const intVal = BerDecoder.decodeInteger(node.rawBytes);
        return {
          typeName: 'INTEGER',
          value: intVal,
          formattedValue: String(intVal),
        };
      }
      case ASN1_TAGS.OCTET_STRING: {
        const strVal = BerDecoder.decodeOctetString(node.rawBytes);
        return {
          typeName: 'OCTET_STRING',
          value: strVal,
          formattedValue: strVal,
        };
      }
      case ASN1_TAGS.NULL: {
        return {
          typeName: 'NULL',
          value: null,
          formattedValue: 'NULL',
        };
      }
      case ASN1_TAGS.OBJECT_IDENTIFIER: {
        const oidVal = BerDecoder.decodeOid(node.rawBytes);
        return {
          typeName: 'OBJECT_IDENTIFIER',
          value: oidVal,
          formattedValue: oidVal,
        };
      }
      case ASN1_TAGS.IP_ADDRESS: {
        const ipStr = Array.from(node.rawBytes).join('.');
        return {
          typeName: 'IP_ADDRESS',
          value: ipStr,
          formattedValue: ipStr,
        };
      }
      case ASN1_TAGS.COUNTER_32: {
        const counterVal = BerDecoder.decodeUnsigned32(node.rawBytes);
        return {
          typeName: 'COUNTER_32',
          value: counterVal,
          formattedValue: `${counterVal.toLocaleString('en-US')} octets`,
        };
      }
      case ASN1_TAGS.GAUGE_32: {
        const gaugeVal = BerDecoder.decodeUnsigned32(node.rawBytes);
        return {
          typeName: 'GAUGE_32',
          value: gaugeVal,
          formattedValue: String(gaugeVal),
        };
      }
      case ASN1_TAGS.TIME_TICKS: {
        const ticksVal = BerDecoder.decodeUnsigned32(node.rawBytes);
        return {
          typeName: 'TIME_TICKS',
          value: ticksVal,
          formattedValue: BerDecoder.formatTimeTicks(ticksVal),
        };
      }
      case ASN1_TAGS.NO_SUCH_OBJECT:
      case ASN1_TAGS.NO_SUCH_INSTANCE:
      case ASN1_TAGS.END_OF_MIB_VIEW: {
        const exceptionLabel =
          node.tag === ASN1_TAGS.NO_SUCH_OBJECT
            ? 'noSuchObject'
            : node.tag === ASN1_TAGS.NO_SUCH_INSTANCE
              ? 'noSuchInstance'
              : 'endOfMibView';
        return {
          typeName: 'EXCEPTION',
          value: null,
          formattedValue: exceptionLabel,
        };
      }
      default: {
        const hex = Array.from(node.rawBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
        return {
          typeName: 'UNKNOWN',
          value: hex,
          formattedValue: `0x${node.tag.toString(16)}: ${hex}`,
        };
      }
    }
  }
}
