export type CellularGeneration = '2G' | '3G' | '4G' | '5G' | 'UNKNOWN';

export interface CellularInfo {
  carrier: string;
  radioType: string; // e.g. "LTE", "NR" (5G), "HSPA", "WCDMA", "GSM"
  generation: CellularGeneration;
  signalStrengthDbm: number | null; // RSSI o RSRP en dBm
  signalLevel: number; // Nivel normalizado 0 a 4 (Android SignalStrength level)
  isRegistered: boolean;
}

export interface LatencyMetric {
  host: string;
  minMs: number;
  avgMs: number;
  maxMs: number;
  jitterMs: number;
  packetLossPercent: number;
  samples: number[];
  timestamp: number;
}

export interface ThroughputMetric {
  direction: 'download' | 'upload';
  bytesTransferred: number;
  durationMs: number;
  speedMbps: number;
  timestamp: number;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
}

export interface QoSMeasurementPoint {
  id: string;
  timestamp: number;
  connectionType: string; // 'wifi' | 'cellular' | 'none' | 'unknown'
  isConnected: boolean;
  cellularInfo?: CellularInfo;
  location?: GeoLocation;
  latency?: LatencyMetric;
  throughput?: ThroughputMetric;
}
