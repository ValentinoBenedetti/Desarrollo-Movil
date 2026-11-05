import { ASN1_TAGS } from '../../../core/constants/oids';

/**
 * Low-level ASN.1 Basic Encoding Rules (BER) Binary Encoder (ITU-T X.690).
 * Encodes primitive and constructed SNMP v1/v2c types into raw byte arrays
 * suitable for transmission over UDP/161 sockets.
 */
export class BerEncoder {
  /**
   * Encodes the BER definite-length field for a given byte length.
   * - Short form (0..127): single byte [length]
   * - Long form (>= 128): [0x80 | numOctets, ...bigEndianLengthOctets]
   */
  public static encodeLength(length: number): Uint8Array {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError(`Invalid BER length: ${length}`);
    }

    if (length < 0x80) {
      return new Uint8Array([length]);
    }

    const octets: number[] = [];
    let remaining = length;
    while (remaining > 0) {
      octets.unshift(remaining & 0xff);
      remaining = Math.floor(remaining / 256);
    }

    return new Uint8Array([0x80 | octets.length, ...octets]);
  }

  /**
   * Wraps a payload with an ASN.1 Tag and BER Length header (TLV).
   */
  public static wrapTlv(tag: number, valueBytes: Uint8Array): Uint8Array {
    const lengthBytes = BerEncoder.encodeLength(valueBytes.length);
    const result = new Uint8Array(1 + lengthBytes.length + valueBytes.length);
    result[0] = tag & 0xff;
    result.set(lengthBytes, 1);
    result.set(valueBytes, 1 + lengthBytes.length);
    return result;
  }

  /**
   * Concatenates multiple Uint8Array chunks into a single contiguous buffer.
   */
  public static concatBuffers(chunks: readonly Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  }

  /**
   * Encodes a signed 32-bit INTEGER (Tag 0x02) using minimal two's complement octets.
   */
  public static encodeInteger(value: number): Uint8Array {
    if (!Number.isInteger(value)) {
      throw new TypeError(`ASN.1 INTEGER must be a whole number, received: ${value}`);
    }

    if (value === 0) {
      return new Uint8Array([ASN1_TAGS.INTEGER, 0x01, 0x00]);
    }

    const bytes: number[] = [];
    if (value > 0) {
      let temp = value;
      while (temp > 0) {
        bytes.unshift(temp & 0xff);
        temp = Math.floor(temp / 256);
      }
      // If the MSB has bit 7 set (0x80), prepend 0x00 so it is not decoded as negative
      if ((bytes[0] & 0x80) !== 0) {
        bytes.unshift(0x00);
      }
    } else {
      // Negative two's complement encoding
      let byteCount = 1;
      let minVal = -128;
      while (value < minVal) {
        byteCount++;
        minVal *= 256;
      }
      let twosComplement = Math.pow(256, byteCount) + value;
      for (let i = 0; i < byteCount; i++) {
        bytes.unshift(twosComplement & 0xff);
        twosComplement = Math.floor(twosComplement / 256);
      }
    }

    return BerEncoder.wrapTlv(ASN1_TAGS.INTEGER, new Uint8Array(bytes));
  }

  /**
   * Encodes an unsigned 32-bit application integer such as Counter32 (0x41),
   * Gauge32 (0x42), or TimeTicks (0x43).
   */
  public static encodeUnsignedApplicationInt(tag: number, value: number): Uint8Array {
    const unsigned = Math.max(0, Math.floor(value)) >>> 0;
    if (unsigned === 0) {
      return new Uint8Array([tag & 0xff, 0x01, 0x00]);
    }

    const bytes: number[] = [];
    let temp = unsigned;
    while (temp > 0) {
      bytes.unshift(temp & 0xff);
      temp = Math.floor(temp / 256);
    }

    if ((bytes[0] & 0x80) !== 0) {
      bytes.unshift(0x00);
    }

    return BerEncoder.wrapTlv(tag, new Uint8Array(bytes));
  }

  /**
   * Encodes an OCTET STRING (Tag 0x04) from a UTF-8 string or raw byte array.
   */
  public static encodeOctetString(value: string | Uint8Array): Uint8Array {
    let rawBytes: Uint8Array;
    if (typeof value === 'string') {
      const encoded: number[] = [];
      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code < 0x80) {
          encoded.push(code);
        } else if (code < 0x800) {
          encoded.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else {
          encoded.push(
            0xe0 | (code >> 12),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f),
          );
        }
      }
      rawBytes = new Uint8Array(encoded);
    } else {
      rawBytes = value;
    }

    return BerEncoder.wrapTlv(ASN1_TAGS.OCTET_STRING, rawBytes);
  }

  /**
   * Encodes an ASN.1 NULL value (Tag 0x05, Length 0x00).
   */
  public static encodeNull(): Uint8Array {
    return new Uint8Array([ASN1_TAGS.NULL, 0x00]);
  }

  /**
   * Encodes a dotted-decimal OBJECT IDENTIFIER (Tag 0x06) into BER format:
   * - First two arcs X.Y are merged into a single byte (40 * X + Y).
   * - Subsequent sub-identifiers are encoded in base-128 big-endian VLQ
   *   with bit 7 (0x80) set on all octets except the final octet of each sub-identifier.
   */
  public static encodeOid(oidString: string): Uint8Array {
    const cleaned = oidString.trim().replace(/^\./, '');
    const parts = cleaned.split('.').map(part => {
      const parsed = Number.parseInt(part, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(`Invalid OID arc "${part}" in OID "${oidString}"`);
      }
      return parsed;
    });

    if (parts.length < 2) {
      throw new Error(`OID must contain at least 2 arcs: "${oidString}"`);
    }
    if (parts[0] > 2 || (parts[0] < 2 && parts[1] >= 40)) {
      throw new Error(`Invalid root OID arcs: "${oidString}"`);
    }

    const encodedBytes: number[] = [];
    const firstSubId = parts[0] * 40 + parts[1];
    BerEncoder.pushBase128SubIdentifier(encodedBytes, firstSubId);

    for (let i = 2; i < parts.length; i++) {
      BerEncoder.pushBase128SubIdentifier(encodedBytes, parts[i]);
    }

    return BerEncoder.wrapTlv(ASN1_TAGS.OBJECT_IDENTIFIER, new Uint8Array(encodedBytes));
  }

  /**
   * Encodes a single OID sub-identifier in base-128 big-endian continuation format.
   */
  private static pushBase128SubIdentifier(target: number[], subId: number): void {
    if (subId < 0x80) {
      target.push(subId & 0x7f);
      return;
    }

    const septets: number[] = [];
    let remaining = subId;
    septets.unshift(remaining & 0x7f);
    remaining = Math.floor(remaining / 128);

    while (remaining > 0) {
      septets.unshift((remaining & 0x7f) | 0x80);
      remaining = Math.floor(remaining / 128);
    }

    for (const byte of septets) {
      target.push(byte);
    }
  }

  /**
   * Encodes an ASN.1 SEQUENCE (Tag 0x30) containing ordered child TLV elements.
   */
  public static encodeSequence(elements: readonly Uint8Array[]): Uint8Array {
    const payload = BerEncoder.concatBuffers(elements);
    return BerEncoder.wrapTlv(ASN1_TAGS.SEQUENCE, payload);
  }

  /**
   * Encodes an implicit constructed SNMP PDU (e.g. 0xA0 GetRequest-PDU, 0xA2 GetResponse-PDU).
   */
  public static encodePdu(pduTag: number, elements: readonly Uint8Array[]): Uint8Array {
    const payload = BerEncoder.concatBuffers(elements);
    return BerEncoder.wrapTlv(pduTag, payload);
  }
}
