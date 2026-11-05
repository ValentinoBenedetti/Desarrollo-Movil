import RNFS from 'react-native-fs';
import { Camera, CodeType, PhotoFile } from 'react-native-vision-camera';
import {
  CapturedPhotoEvidence,
  GeoCoordinates,
  ScannedEquipmentCode,
} from '../../core/types';

/**
 * Field Evidence Capture & Equipment Barcode/QR Identification Service
 * powered by `react-native-vision-camera` and `react-native-fs`.
 */
export class CameraService {
  public static readonly SUPPORTED_CODE_TYPES: CodeType[] = ['qr', 'code-128', 'ean-13'];

  /**
   * Requests native hardware camera permissions.
   */
  public async requestCameraPermission(): Promise<boolean> {
    const currentStatus = Camera.getCameraPermissionStatus();
    if (currentStatus === 'granted') {
      return true;
    }
    const newStatus = await Camera.requestCameraPermission();
    return newStatus === 'granted';
  }

  /**
   * Captures a high-resolution photo from an active VisionCamera ref, attaches
   * GPS coordinates + UTC timestamp, and loads a base64 data URI for PDF embedding.
   */
  public async captureGeoreferencedPhoto(
    cameraRef: Camera,
    coordinates: GeoCoordinates,
  ): Promise<CapturedPhotoEvidence> {
    const photo: PhotoFile = await cameraRef.takePhoto({
      flash: 'off',
      enableShutterSound: true,
    });

    const normalizedPath = photo.path.startsWith('file://')
      ? photo.path.replace('file://', '')
      : photo.path;
    const fileUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;

    const stat = await RNFS.stat(normalizedPath);
    const base64Data = await RNFS.readFile(normalizedPath, 'base64');
    const fileName = `evidence_${Date.now()}.jpg`;

    return {
      uri: fileUri,
      fileName,
      mimeType: 'image/jpeg',
      sizeBytes: Number(stat.size) || 0,
      capturedAtUtc: new Date().toISOString(),
      coordinates,
      base64Preview: `data:image/jpeg;base64,${base64Data}`,
    };
  }

  /**
   * Parses raw QR or barcode strings scanned from telecom chassis labels
   * (supports JSON stickers, key-value pairs `SN=...|MODEL=...|MAC=...`, or raw serial numbers).
   */
  public parseEquipmentBarcode(
    rawValue: string,
    format: ScannedEquipmentCode['format'] = 'qr',
  ): ScannedEquipmentCode {
    const trimmed = rawValue.trim();
    const scannedAtUtc = new Date().toISOString();

    // Case 1: JSON QR sticker payload
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, string>;
        return {
          rawValue: trimmed,
          format,
          serialNumber: parsed.sn || parsed.serial || parsed.serialNumber || 'SN-UNKNOWN',
          model: parsed.model || parsed.product || 'Telecom CPE',
          vendor: parsed.vendor || parsed.brand || 'Generic Telecom',
          macAddress: parsed.mac?.toUpperCase(),
          defaultIp: parsed.ip,
          scannedAtUtc,
        };
      } catch {
        // Fall through to delimiter parsing
      }
    }

    // Case 2: Semicolon or pipe delimited telecom asset sticker (e.g. "SN:HWTC12345678;MODEL:HG8245H;VENDOR:HUAWEI;MAC:00:E0:FC:11:22:33")
    if (trimmed.includes(':') && (trimmed.includes(';') || trimmed.includes('|'))) {
      const kvMap: Record<string, string> = {};
      const tokens = trimmed.split(/[;|]/);
      for (const token of tokens) {
        const sepIdx = token.indexOf(':');
        if (sepIdx > 0) {
          const k = token.slice(0, sepIdx).trim().toLowerCase();
          const v = token.slice(sepIdx + 1).trim();
          kvMap[k] = v;
        }
      }
      return {
        rawValue: trimmed,
        format,
        serialNumber: kvMap.sn || kvMap.serial || trimmed.slice(0, 24),
        model: kvMap.model || 'Network Appliance',
        vendor: kvMap.vendor || 'Telecom Vendor',
        macAddress: kvMap.mac?.toUpperCase(),
        defaultIp: kvMap.ip,
        scannedAtUtc,
      };
    }

    // Case 3: Plain Code-128 / EAN-13 serial number barcode
    return {
      rawValue: trimmed,
      format,
      serialNumber: trimmed,
      model: this.inferModelFromSerialPrefix(trimmed),
      vendor: this.inferVendorFromSerialPrefix(trimmed),
      scannedAtUtc,
    };
  }

  private inferVendorFromSerialPrefix(serial: string): string {
    const upper = serial.toUpperCase();
    if (upper.startsWith('FCH') || upper.startsWith('FCW') || upper.startsWith('FOC')) {
      return 'Cisco Systems';
    }
    if (upper.startsWith('HWTC') || upper.startsWith('2102') || upper.startsWith('4857')) {
      return 'Huawei Technologies';
    }
    if (upper.startsWith('HE') || upper.startsWith('HD') || upper.startsWith('MikroTik')) {
      return 'MikroTik';
    }
    return 'Standard Telecom OEM';
  }

  private inferModelFromSerialPrefix(serial: string): string {
    const upper = serial.toUpperCase();
    if (upper.startsWith('HWTC')) {
      return 'Huawei SmartAX GPON ONT';
    }
    if (upper.startsWith('FCH') || upper.startsWith('FCW')) {
      return 'Cisco Catalyst / ISR Node';
    }
    if (upper.startsWith('HE') || upper.startsWith('HD')) {
      return 'MikroTik RouterBOARD';
    }
    return 'Managed L2/L3 Node';
  }
}

export const cameraService = new CameraService();

