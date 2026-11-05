import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import {
  CapturedPhotoEvidence,
  GeoCoordinates,
} from '../../core/types';
import { cameraService, CameraService } from '../../layers/evidence/CameraService';
import {
  geoLocationService,
  GeoLocationService,
} from '../../layers/evidence/GeoLocationService';
import { pdfGenerator } from '../../layers/reporting/PdfGenerator';
import { StoreRepository } from '../../layers/store/database';
import { outboxManager } from '../../layers/sync/OutboxManager';
import { syncWorker } from '../../layers/sync/SyncWorker';
import { SyncBadge } from '../components/SyncBadge';
import { RootTabParamList } from '../navigation/types';

type CameraMode = 'closed' | 'qr' | 'photo';

export const InstallationScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootTabParamList, 'Installation'>>();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const cameraRef = useRef<Camera | null>(null);
  const cameraDevice = useCameraDevice('back');

  const routeDevice = route.params?.device;

  const [siteName, setSiteName] = useState('NOC Cell Tower Node #04');
  const [technicianId, setTechnicianId] = useState('TECH-FCYT-2026');
  const [deviceIp, setDeviceIp] = useState(routeDevice?.ip ?? '192.168.1.1');
  const [deviceMac, setDeviceMac] = useState(routeDevice?.mac ?? '4C:5E:0C:88:11:02');
  const [deviceHostname, setDeviceHostname] = useState(
    routeDevice?.hostname ?? 'core-edge-rtr01',
  );
  const [serialNumber, setSerialNumber] = useState(routeDevice?.serialCode ?? '');
  const [equipmentModel, setEquipmentModel] = useState(
    routeDevice?.vendor ?? 'MikroTik CCR2004-16G-2S+',
  );
  const [notes, setNotes] = useState(
    'Optical attenuation verified (-18.4 dBm). Primary and backup uplinks operational.',
  );

  const [cameraMode, setCameraMode] = useState<CameraMode>('closed');
  const [coordinates, setCoordinates] = useState<GeoCoordinates | null>(null);
  const [photoEvidence, setPhotoEvidence] = useState<CapturedPhotoEvidence | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    if (routeDevice) {
      setDeviceIp(routeDevice.ip);
      setDeviceMac(routeDevice.mac);
      setDeviceHostname(routeDevice.hostname);
      if (routeDevice.serialCode) {
        setSerialNumber(routeDevice.serialCode);
      }
      if (routeDevice.vendor) {
        setEquipmentModel(routeDevice.vendor);
      }
    }
  }, [routeDevice]);

  const codeScanner = useCodeScanner({
    codeTypes: CameraService.SUPPORTED_CODE_TYPES,
    onCodeScanned: codes => {
      if (cameraMode !== 'qr' || codes.length === 0) {
        return;
      }
      const first = codes[0];
      if (!first.value) {
        return;
      }
      const parsed = cameraService.parseEquipmentBarcode(first.value, 'qr');
      setSerialNumber(parsed.serialNumber);
      setEquipmentModel(`${parsed.vendor} ${parsed.model}`);
      if (parsed.macAddress) {
        setDeviceMac(parsed.macAddress);
      }
      if (parsed.defaultIp) {
        setDeviceIp(parsed.defaultIp);
      }
      setCameraMode('closed');
      setStatusBanner(
        `Scanned Equipment Code: SN=${parsed.serialNumber} (${parsed.vendor} ${parsed.model})`,
      );
    },
  });

  const handleOpenCamera = async (mode: 'qr' | 'photo') => {
    const granted = await cameraService.requestCameraPermission();
    if (!granted) {
      setStatusBanner('Camera permission denied by OS.');
      return;
    }
    setCameraMode(mode);
  };

  const handleAcquireGps = async (): Promise<GeoCoordinates | null> => {
    setIsAcquiringGps(true);
    setStatusBanner('Acquiring high-precision satellite GPS fix (UTC)...');
    try {
      const fix = await geoLocationService.getCurrentCoordinates(15000);
      setCoordinates(fix);
      setStatusBanner(`GPS locked: ${GeoLocationService.formatCoordinates(fix)}`);
      return fix;
    } catch (err) {
      setStatusBanner(
        err instanceof Error ? err.message : 'Failed to acquire GPS coordinates',
      );
      return null;
    } finally {
      setIsAcquiringGps(false);
    }
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current) {
      return;
    }
    try {
      const activeCoords = coordinates ?? (await handleAcquireGps());
      if (!activeCoords) {
        return;
      }
      const captured = await cameraService.captureGeoreferencedPhoto(
        cameraRef.current,
        activeCoords,
      );
      setPhotoEvidence(captured);
      setCameraMode('closed');
      setStatusBanner(
        `Georeferenced photo captured (${Math.round(captured.sizeBytes / 1024)} KB) @ ${captured.capturedAtUtc}`,
      );
    } catch (err) {
      setStatusBanner(
        err instanceof Error ? err.message : 'Failed to capture photo evidence',
      );
    }
  };

  const handleCompleteInstallation = async () => {
    if (!serialNumber.trim()) {
      setStatusBanner('Equipment Serial Number (via QR/Barcode or manual input) is required.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const activeCoords = coordinates ?? (await handleAcquireGps());
      if (!activeCoords) {
        throw new Error(
          'High-precision GPS coordinates are required to certify the field installation.',
        );
      }

      const persistedDevice = await StoreRepository.upsertDiscoveredDevice(
        {
          ip: deviceIp,
          mac: deviceMac,
          hostname: deviceHostname,
          vendor: equipmentModel,
          services: ['COMMISSIONED'],
          snmpReachable: true,
          sshReachable: true,
          responseTimeMs: 1,
          lastSeen: Date.now(),
          serialCode: serialNumber,
        },
        serialNumber,
        equipmentModel,
      );

      const orderInput = {
        deviceId: persistedDevice.id,
        deviceIp,
        deviceMac,
        deviceHostname,
        serialNumber,
        equipmentModel,
        siteName,
        technicianId,
        notes,
        coordinates: activeCoords,
        photoUri: photoEvidence?.uri ?? '',
        photoBase64: photoEvidence?.base64Preview,
        snmpSummary: route.params?.snmpSummary ?? null,
        sshOutput: route.params?.sshOutput ?? '',
      };

      setStatusBanner('Generating corporate PDF installation report...');
      const generatedPdf = await pdfGenerator.generateInstallationPdf(orderInput);

      setStatusBanner('Persisting to WatermelonDB & enqueueing in Outbox...');
      const { outboxItem } = await outboxManager.recordInstallationAndEnqueue(
        orderInput,
        generatedPdf.fileUri,
        generatedPdf.reportId,
      );

      setStatusBanner(
        `Report ${generatedPdf.reportId} generated (${generatedPdf.filePath}) & queued in Outbox (${outboxItem.id}).`,
      );

      syncWorker.processPendingOutbox().catch(() => {});
      navigation.navigate('History');
    } catch (err) {
      setStatusBanner(
        err instanceof Error ? err.message : 'Failed to generate installation report',
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>Field Installation Wizard</Text>
          <Text style={styles.screenSubtitle}>QR/Barcode + Geotagged Photo + PDF</Text>
        </View>
        <SyncBadge />
      </View>

      {statusBanner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{statusBanner}</Text>
        </View>
      )}

      {/* Active VisionCamera Viewport when scanning QR or taking Evidence Photo */}
      {cameraMode !== 'closed' && (
        <View style={styles.cameraContainer}>
          {cameraDevice ? (
            <Camera
              ref={cameraRef}
              style={styles.cameraPreview}
              device={cameraDevice}
              isActive={true}
              photo={cameraMode === 'photo'}
              codeScanner={cameraMode === 'qr' ? codeScanner : undefined}
            />
          ) : (
            <View style={styles.cameraFallback}>
              <Text style={styles.cameraFallbackText}>
                No rear camera hardware detected on this device.
              </Text>
            </View>
          )}
          <View style={styles.cameraControls}>
            {cameraMode === 'photo' && (
              <TouchableOpacity
                style={styles.shutterButton}
                onPress={handleCapturePhoto}>
                <Text style={styles.shutterText}>CAPTURE GEOTAGGED PHOTO</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeCamButton}
              onPress={() => setCameraMode('closed')}>
              <Text style={styles.closeCamText}>Close Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 1: QR / Barcode Identification */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>1. Equipment QR / Barcode Identification</Text>
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => handleOpenCamera('qr')}>
            <Text style={styles.actionChipText}>Scan QR / Barcode</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Serial Number (Scanned / Chassis)</Text>
            <TextInput
              style={styles.input}
              value={serialNumber}
              onChangeText={setSerialNumber}
              placeholder="e.g. HWTC892341AB"
              placeholderTextColor="#64748b"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Equipment Model / Vendor</Text>
            <TextInput
              style={styles.input}
              value={equipmentModel}
              onChangeText={setEquipmentModel}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Management IPv4</Text>
            <TextInput
              style={styles.input}
              value={deviceIp}
              onChangeText={setDeviceIp}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Hardware MAC</Text>
            <TextInput
              style={styles.input}
              value={deviceMac}
              onChangeText={setDeviceMac}
            />
          </View>
        </View>
      </View>

      {/* Step 2: GPS Georeferencing & Photo Evidence */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. GPS Georeferencing & Photo Evidence</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            disabled={isAcquiringGps}
            onPress={handleAcquireGps}>
            {isAcquiringGps ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>Acquire High-Precision GPS</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => handleOpenCamera('photo')}>
            <Text style={styles.secondaryBtnText}>Capture Evidence Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.telemetrySummary}>
          <Text style={styles.telemetryLine}>
            <Text style={styles.telemetryKey}>GPS Fix: </Text>
            {coordinates
              ? GeoLocationService.formatCoordinates(coordinates)
              : 'Not acquired yet'}
          </Text>
          <Text style={styles.telemetryLine}>
            <Text style={styles.telemetryKey}>UTC Timestamp: </Text>
            {coordinates?.timestampUtc ?? 'Pending GPS fix'}
          </Text>
          <Text style={styles.telemetryLine}>
            <Text style={styles.telemetryKey}>Photographic Evidence: </Text>
            {photoEvidence
              ? `${photoEvidence.fileName} (${Math.round(photoEvidence.sizeBytes / 1024)} KB)`
              : 'No photo captured yet'}
          </Text>
        </View>
      </View>

      {/* Step 3: Site Metadata & Notes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Site & Engineering Sign-Off</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Installation Site Name</Text>
            <TextInput
              style={styles.input}
              value={siteName}
              onChangeText={setSiteName}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Technician ID</Text>
            <TextInput
              style={styles.input}
              value={technicianId}
              onChangeText={setTechnicianId}
            />
          </View>
        </View>

        <Text style={styles.label}>Field Technical Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity
        style={styles.submitButton}
        disabled={isGeneratingPdf}
        onPress={handleCompleteInstallation}>
        {isGeneratingPdf ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>
            Generate PDF Report & Enqueue in Offline Outbox
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  screenTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  screenSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
  },
  banner: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  bannerText: {
    color: '#e0f2fe',
    fontSize: 12,
  },
  cameraContainer: {
    backgroundColor: '#020617',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  cameraPreview: {
    width: '100%',
    height: 240,
  },
  cameraFallback: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cameraFallbackText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  cameraControls: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    justifyContent: 'flex-end',
    backgroundColor: '#0f172a',
  },
  shutterButton: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  shutterText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  closeCamButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
  },
  closeCamText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  actionChip: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  col: {
    flex: 1,
  },
  label: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#0369a1',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  telemetrySummary: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
    gap: 4,
  },
  telemetryLine: {
    color: '#e2e8f0',
    fontSize: 11,
  },
  telemetryKey: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});

