import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DiscoveredDevice } from '../../core/types';
import { LanScanner, LanScanProgress } from '../../layers/discovery/LanScanner';
import { StoreRepository } from '../../layers/store/database';
import { DeviceCard } from '../components/DeviceCard';
import { SyncBadge } from '../components/SyncBadge';
import { RootTabParamList } from '../navigation/types';

export const DiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const scannerRef = useRef<LanScanner>(new LanScanner());

  const [subnetPrefix, setSubnetPrefix] = useState('192.168.1');
  const [snmpCommunity, setSnmpCommunity] = useState('public');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<LanScanProgress | null>(null);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Ready to sweep /24 subnet via UDP/161, TCP/22, ARP & mDNS.',
  );

  const loadPersistedDevices = useCallback(async () => {
    try {
      const stored = await StoreRepository.listDevices();
      if (stored.length > 0 && devices.length === 0) {
        const mapped: DiscoveredDevice[] = stored.map(d => ({
          ip: d.ip,
          mac: d.mac,
          hostname: d.hostname,
          vendor: d.vendor,
          services: ['CACHED-OFFLINE'],
          snmpReachable: true,
          sshReachable: true,
          responseTimeMs: 1,
          lastSeen: d.lastSeen,
          serialCode: d.serialNumber,
        }));
        setDevices(mapped);
      }
    } catch {
      // Ignore initial DB load error
    }
  }, [devices.length]);

  useEffect(() => {
    scannerRef.current
      .detectLocalSubnetPrefix()
      .then(({ subnetPrefix: detected }) => {
        setSubnetPrefix(detected);
      })
      .catch(() => {});

    loadPersistedDevices();

    return () => {
      scannerRef.current.abortScan();
    };
  }, [loadPersistedDevices]);

  const handleStartScan = async () => {
    if (isScanning) {
      scannerRef.current.abortScan();
      setIsScanning(false);
      setStatusMessage('LAN sweep aborted by operator.');
      return;
    }

    setIsScanning(true);
    setDevices([]);
    setStatusMessage(`Scanning ${subnetPrefix}.1 - ${subnetPrefix}.254 + mDNS multicast...`);

    try {
      const discovered = await scannerRef.current.scanSubnet({
        subnetPrefix,
        snmpCommunity,
        concurrency: 24,
        probeTimeoutMs: 400,
        onProgress: p => setProgress(p),
        onDeviceDiscovered: async dev => {
          setDevices(prev => {
            const idx = prev.findIndex(item => item.ip === dev.ip);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = dev;
              return updated;
            }
            return [...prev, dev];
          });
          await StoreRepository.upsertDiscoveredDevice(dev);
        },
      });

      setStatusMessage(
        `Scan completed: ${discovered.length} active node(s) discovered on ${subnetPrefix}.0/24.`,
      );
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? `Scan error: ${err.message}` : 'Subnet scan failed',
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleDiagnose = async (device: DiscoveredDevice) => {
    const record = await StoreRepository.upsertDiscoveredDevice(device);
    navigation.navigate('Diagnostic', {
      device,
      persistedDeviceId: record.id,
    });
  };

  const handleInstall = async (device: DiscoveredDevice) => {
    const record = await StoreRepository.upsertDiscoveredDevice(device);
    navigation.navigate('Installation', {
      device,
      persistedDeviceId: record.id,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>LAN & mDNS Radar</Text>
          <Text style={styles.screenSubtitle}>Layer 2/3 Active Discovery (/24)</Text>
        </View>
        <SyncBadge />
      </View>

      <View style={styles.controlsCard}>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Subnet /24 Prefix</Text>
            <TextInput
              style={styles.textInput}
              value={subnetPrefix}
              onChangeText={setSubnetPrefix}
              placeholder="192.168.1"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Probe Community</Text>
            <TextInput
              style={styles.textInput}
              value={snmpCommunity}
              onChangeText={setSnmpCommunity}
              placeholder="public"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              secureTextEntry
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonStop]}
          onPress={handleStartScan}>
          {isScanning ? (
            <View style={styles.scanningRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.scanButtonText}>
                Stop Scan ({progress?.scannedHosts ?? 0}/{progress?.totalHosts ?? 253})
              </Text>
            </View>
          ) : (
            <Text style={styles.scanButtonText}>
              Start Active LAN & mDNS Sweep ({subnetPrefix}.0/24)
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={item => item.ip}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <DeviceCard
            device={item}
            onDiagnose={handleDiagnose}
            onInstall={handleInstall}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No Active Nodes Listed</Text>
            <Text style={styles.emptySubtitle}>
              Press &quot;Start Active LAN &amp; mDNS Sweep&quot; to probe the local /24 network
              segment over UDP/161, TCP/22, and mDNS.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingTop: 12,
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
  controlsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  scanButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonStop: {
    backgroundColor: '#dc2626',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyBox: {
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
});

