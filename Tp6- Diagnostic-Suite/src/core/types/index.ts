/**
 * Core Domain Types and Contracts for the Network Diagnostics Suite.
 */

export type SnmpVersion = '1' | '2c';

export type NetworkVendor = 'cisco' | 'mikrotik' | 'huawei' | 'linux';

export type InstallationStatus = 'DRAFT' | 'COMPLETED' | 'PENDING_SYNC' | 'SYNCED';

export type OutboxEventType = 'SYNC_INSTALLATION' | 'SYNC_DIAGNOSTIC';

export type OutboxItemStatus = 'PENDING' | 'IN_FLIGHT' | 'SYNCED' | 'FAILED';

/**
 * Discovered network node on the local /24 subnet via ARP/UDP sweep or mDNS.
 */
export interface DiscoveredDevice {
  ip: string;
  mac: string;
  hostname: string;
  vendor: string;
  services: string[];
  snmpReachable: boolean;
  sshReachable: boolean;
  responseTimeMs: number;
  lastSeen: number;
  serialCode?: string;
}

/**
 * Decoded ASN.1 / BER node representation.
 */
export interface BerDecodedNode {
  tag: number;
  length: number;
  valueOffset: number;
  totalByteLength: number;
  rawBytes: Uint8Array;
  children?: BerDecodedNode[];
}

/**
 * Typed SNMP Variable Binding (VarBind).
 */
export interface SnmpVarBind {
  oid: string;
  label: string;
  tag: number;
  typeName:
    | 'INTEGER'
    | 'OCTET_STRING'
    | 'NULL'
    | 'OBJECT_IDENTIFIER'
    | 'IP_ADDRESS'
    | 'COUNTER_32'
    | 'GAUGE_32'
    | 'TIME_TICKS'
    | 'EXCEPTION'
    | 'UNKNOWN';
  value: string | number | null;
  formattedValue: string;
}

/**
 * Decoded SNMP GetResponse PDU envelope.
 */
export interface SnmpResponsePdu {
  version: SnmpVersion;
  community: string;
  pduType: number;
  requestId: number;
  errorStatus: number;
  errorStatusText: string;
  errorIndex: number;
  varBinds: SnmpVarBind[];
  roundTripTimeMs: number;
}

/**
 * High-level parsed MIB-II telemetry summary persisted in WatermelonDB.
 */
export interface SnmpDiagnosticSummary {
  targetIp: string;
  version: SnmpVersion;
  sysDescr: string;
  sysName: string;
  sysUpTimeTicks: number;
  sysUpTimeFormatted: string;
  ifInOctets1: number;
  ifOutOctets1: number;
  roundTripTimeMs: number;
  queriedAtIso: string;
  rawVarBinds: SnmpVarBind[];
}

/**
 * SSH diagnostic command definition within a vendor profile.
 */
export interface SshDiagnosticCommand {
  id: string;
  label: string;
  command: string;
  description: string;
}

/**
 * Vendor-specific diagnostic command profile.
 */
export interface VendorCommandProfile {
  vendor: NetworkVendor;
  displayName: string;
  defaultPort: number;
  commands: SshDiagnosticCommand[];
}

/**
 * Result of executing an SSH command on a remote target.
 */
export interface SshExecutionResult {
  host: string;
  port: number;
  vendor: NetworkVendor;
  command: string;
  stdout: string;
  executedAtIso: string;
  durationMs: number;
}

/**
 * Secure credentials stored in Android Keystore / iOS Keychain via react-native-keychain.
 */
export interface DeviceVaultCredentials {
  targetIp: string;
  snmpCommunity: string;
  snmpVersion: SnmpVersion;
  sshUsername: string;
  sshPassword?: string;
  sshPrivateKey?: string;
   sshPort: number;
  vendor: NetworkVendor;
  updatedAtIso: string;
}

/**
 * High-precision GPS fix with UTC timestamp.
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracyMeters: number;
  timestampUtc: string;
}

/**
 * Captured photo evidence with embedded georeference context.
 */
export interface CapturedPhotoEvidence {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  capturedAtUtc: string;
  coordinates: GeoCoordinates;
  base64Preview?: string;
}

/**
 * Parsed QR / Barcode equipment identifier.
 */
export interface ScannedEquipmentCode {
  rawValue: string;
  format: 'qr' | 'code-128' | 'ean-13' | 'manual';
  serialNumber: string;
  model: string;
  vendor: string;
  macAddress?: string;
  defaultIp?: string;
  scannedAtUtc: string;
}

/**
 * Complete field installation order record.
 */
export interface InstallationOrderInput {
  deviceId: string;
  deviceIp: string;
  deviceMac: string;
  deviceHostname: string;
  serialNumber: string;
  equipmentModel: string;
  siteName: string;
  technicianId: string;
  notes: string;
  coordinates: GeoCoordinates;
  photoUri: string;
  photoBase64?: string;
  snmpSummary?: SnmpDiagnosticSummary | null;
  sshOutput?: string;
}

/**
 * Transactional Outbox payload sent to /api/sync.
 */
export interface SyncBatchRequestItem {
  outboxId: string;
  eventType: OutboxEventType;
  createdAtIso: string;
  attempts: number;
  payload: Record<string, unknown>;
}

export interface SyncBatchResponse {
  status: 'ok' | 'error';
  processed_ids: string[];
  received_at: string;
  message?: string;
}

