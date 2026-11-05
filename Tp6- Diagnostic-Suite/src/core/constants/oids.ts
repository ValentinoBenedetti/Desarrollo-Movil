/**
 * Standard MIB-II Object Identifiers (RFC 1213) and ASN.1/BER Tag Constants
 * used by the binary SNMP v1/v2c protocol engine over UDP/161.
 */

export const MIB2_OIDS = {
  /** System Description (OCTET STRING) - hardware, OS, and networking software */
  SYS_DESCR: '1.3.6.1.2.1.1.1.0',
  /** System Object ID (OBJECT IDENTIFIER) - vendor authoritative identification */
  SYS_OBJECT_ID: '1.3.6.1.2.1.1.2.0',
  /** System UpTime (TimeTicks) - hundredths of a second since network management re-initialized */
  SYS_UP_TIME: '1.3.6.1.2.1.1.3.0',
  /** System Contact (OCTET STRING) */
  SYS_CONTACT: '1.3.6.1.2.1.1.4.0',
  /** System Name (OCTET STRING) - administratively-assigned FQDN/hostname */
  SYS_NAME: '1.3.6.1.2.1.1.5.0',
  /** System Location (OCTET STRING) */
  SYS_LOCATION: '1.3.6.1.2.1.1.6.0',
  /** Total number of network interfaces (INTEGER) */
  IF_NUMBER: '1.3.6.1.2.1.2.1.0',
  /** Inbound octets on interface 1 (Counter32) */
  IF_IN_OCTETS_1: '1.3.6.1.2.1.2.2.1.10.1',
  /** Outbound octets on interface 1 (Counter32) */
  IF_OUT_OCTETS_1: '1.3.6.1.2.1.2.2.1.16.1',
} as const;

export const DEFAULT_DIAGNOSTIC_OIDS: readonly string[] = [
  MIB2_OIDS.SYS_DESCR,
  MIB2_OIDS.SYS_UP_TIME,
  MIB2_OIDS.SYS_NAME,
  MIB2_OIDS.IF_IN_OCTETS_1,
  MIB2_OIDS.IF_OUT_OCTETS_1,
] as const;

export const OID_LABELS: Record<string, string> = {
  [MIB2_OIDS.SYS_DESCR]: 'sysDescr.0',
  [MIB2_OIDS.SYS_OBJECT_ID]: 'sysObjectID.0',
  [MIB2_OIDS.SYS_UP_TIME]: 'sysUpTime.0',
  [MIB2_OIDS.SYS_CONTACT]: 'sysContact.0',
  [MIB2_OIDS.SYS_NAME]: 'sysName.0',
  [MIB2_OIDS.SYS_LOCATION]: 'sysLocation.0',
  [MIB2_OIDS.IF_NUMBER]: 'ifNumber.0',
  [MIB2_OIDS.IF_IN_OCTETS_1]: 'ifInOctets.1',
  [MIB2_OIDS.IF_OUT_OCTETS_1]: 'ifOutOctets.1',
};

/**
 * Helper to build interface-specific Counter32 OIDs for any interface index (1..N).
 */
export function buildInterfaceTrafficOids(ifIndex: number): {
  inOctetsOid: string;
  outOctetsOid: string;
} {
  const safeIndex = Math.max(1, Math.floor(ifIndex));
  return {
    inOctetsOid: `1.3.6.1.2.1.2.2.1.10.${safeIndex}`,
    outOctetsOid: `1.3.6.1.2.1.2.2.1.16.${safeIndex}`,
  };
}

/**
 * ASN.1 / Basic Encoding Rules (BER) universal and application-specific tags
 * per ITU-T X.690, RFC 1155 (SMI), and RFC 1157 / RFC 1905 (SNMP v1/v2c).
 */
export const ASN1_TAGS = {
  INTEGER: 0x02,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OBJECT_IDENTIFIER: 0x06,
  SEQUENCE: 0x30,
  IP_ADDRESS: 0x40,
  COUNTER_32: 0x41,
  GAUGE_32: 0x42,
  TIME_TICKS: 0x43,
  OPAQUE: 0x44,
  COUNTER_64: 0x46,
  NO_SUCH_OBJECT: 0x80,
  NO_SUCH_INSTANCE: 0x81,
  END_OF_MIB_VIEW: 0x82,
  GET_REQUEST_PDU: 0xa0,
  GET_NEXT_REQUEST_PDU: 0xa1,
  GET_RESPONSE_PDU: 0xa2,
  SET_REQUEST_PDU: 0xa3,
  TRAP_V1_PDU: 0xa4,
  GET_BULK_REQUEST_PDU: 0xa5,
} as const;

export const SNMP_VERSION_CODES = {
  V1: 0x00,
  V2C: 0x01,
} as const;

export const SNMP_ERROR_STATUS_LABELS: Record<number, string> = {
  0: 'noError',
  1: 'tooBig',
  2: 'noSuchName',
  3: 'badValue',
  4: 'readOnly',
  5: 'genErr',
  6: 'noAccess',
  7: 'wrongType',
  8: 'wrongLength',
  9: 'wrongEncoding',
  10: 'wrongValue',
  11: 'noCreation',
  12: 'inconsistentValue',
  13: 'resourceUnavailable',
  14: 'commitFailed',
  15: 'undoFailed',
  16: 'authorizationError',
  17: 'notWritable',
  18: 'inconsistentName',
};

/**
 * Common IEEE OUI MAC prefix mapping for telecommunications vendors.
 */
export const TELECOM_OUI_VENDORS: Record<string, string> = {
  '00:00:0C': 'Cisco Systems',
  '00:1B:54': 'Cisco Systems',
  'F8:72:EA': 'Cisco Systems',
  '4C:5E:0C': 'MikroTik (RouterBOARD)',
  'D4:CA:6D': 'MikroTik (RouterBOARD)',
  'E4:8D:8C': 'MikroTik (RouterBOARD)',
  'B8:69:F4': 'MikroTik (RouterBOARD)',
  '00:E0:FC': 'Huawei Technologies',
  '48:46:FB': 'Huawei Technologies',
  '84:A8:E4': 'Huawei Technologies',
  '24:A4:3C': 'Ubiquiti Networks',
  '78:8A:20': 'Ubiquiti Networks',
  'F0:9F:C2': 'Ubiquiti Networks',
  '50:C7:BF': 'TP-Link Technologies',
  'E8:DE:27': 'TP-Link Technologies',
};

