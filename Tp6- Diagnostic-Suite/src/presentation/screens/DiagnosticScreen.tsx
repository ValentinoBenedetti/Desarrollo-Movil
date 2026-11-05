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
  NetworkVendor,
  SnmpDiagnosticSummary,
  SnmpVersion,
  SshDiagnosticCommand,
  SshExecutionResult,
} from '../../core/types';
import { SnmpClient } from '../../layers/protocol/snmp/SnmpClient';
import { inferVendorFromDescription } from '../../layers/protocol/ssh/CommandProfiles';
import { SshClient } from '../../layers/protocol/ssh/SshClient';
import { vaultService } from '../../layers/security/VaultService';
import { StoreRepository } from '../../layers/store/database';
import { outboxManager } from '../../layers/sync/OutboxManager';
import { syncWorker } from '../../layers/sync/SyncWorker';
import { SyncBadge } from '../components/SyncBadge';
import { TerminalView } from '../components/TerminalView';
import { RootTabParamList } from '../navigation/types';

export const DiagnosticScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootTabParamList, 'Diagnostic'>>();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const snmpClientRef = useRef<SnmpClient>(new SnmpClient());
  const sshClientRef = useRef<SshClient>(new SshClient());

  const initialDevice = route.params?.device;
  const [targetIp, setTargetIp] = useState(initialDevice?.ip ?? '192.168.1.1');
  const [snmpVersion, setSnmpVersion] = useState<SnmpVersion>('2c');
  const [snmpCommunity, setSnmpCommunity] = useState('public');
  const [sshUsername, setSshUsername] = useState('admin');
  const [sshPassword, setSshPassword] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [vendor, setVendor] = useState<NetworkVendor>('linux');

  const [isQueryingSnmp, setIsQueryingSnmp] = useState(false);
  const [snmpSummary, setSnmpSummary] = useState<SnmpDiagnosticSummary | null>(null);
  const [isExecutingSsh, setIsExecutingSsh] = useState(false);
  const [sshTranscript, setSshTranscript] = useState<SshExecutionResult[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialDevice?.ip) {
      setTargetIp(initialDevice.ip);
      if (initialDevice.vendor) {
        setVendor(inferVendorFromDescription(initialDevice.vendor));
      }
    }
  }, [initialDevice]);

  // Load credentials from Android Keystore / iOS Keychain when targetIp changes
  useEffect(() => {
    let active = true;
    vaultService
      .getDeviceCredentials(targetIp)
      .then(creds => {
        if (active && creds) {
          setSnmpCommunity(creds.snmpCommunity);
          setSnmpVersion(creds.snmpVersion);
          setSshUsername(creds.sshUsername);
          setSshPassword(creds.sshPassword ?? '');
          setSshPort(String(creds.sshPort || 22));
          setVendor(creds.vendor);
          setFeedbackMessage(`Loaded hardware-encrypted credentials for ${targetIp} from Vault.`);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [targetIp]);

  const handleSaveToVault = async () => {
    try {
      await vaultService.saveDeviceCredentials({
        targetIp,
        snmpCommunity,
        snmpVersion,
        sshUsername,
        sshPassword,
        sshPort: Number.parseInt(sshPort, 10) || 22,
        vendor,
        updatedAtIso: new Date().toISOString(),
      });
      setFeedbackMessage(
        `Credentials for ${targetIp} encrypted in OS Keystore/Keychain (Zero-Trust).`,
      );
    } catch (err) {
      setFeedbackMessage(
        err instanceof Error ? `Vault error: ${err.message}` : 'Failed to save credentials',
      );
    }
  };

  const handleQuerySnmp = async () => {
    setIsQueryingSnmp(true);
    setFeedbackMessage(`Sending binary ASN.1/BER GetRequest to ${targetIp}:161/udp...`);
    try {
      const summary = await snmpClientRef.current.queryDeviceSummary(
        targetIp,
        snmpCommunity,
        snmpVersion,
        3000,
      );
      setSnmpSummary(summary);
      const detectedVendor = inferVendorFromDescription(summary.sysDescr);
      setVendor(detectedVendor);
      setFeedbackMessage(
        `SNMP GetResponse decoded in ${summary.roundTripTimeMs} ms (${summary.rawVarBinds.length} VarBinds).`,
      );
    } catch (err) {
      setFeedbackMessage(
        err instanceof Error ? err.message : 'SNMP query failed over UDP/161',
      );
    } finally {
      setIsQueryingSnmp(false);
    }
  };

  const handleExecuteSshCommand = async (cmd: SshDiagnosticCommand) => {
    setIsExecutingSsh(true);
    setFeedbackMessage(`Connecting via SSHv2 to ${targetIp}:${sshPort} for "${cmd.command}"...`);
    try {
      const ssh = sshClientRef.current;
      await ssh.connect({
        host: targetIp,
        port: Number.parseInt(sshPort, 10) || 22,
        username: sshUsername,
        password: sshPassword,
        vendor,
      });
      const result = await ssh.executeCommand(cmd.command);
      await ssh.disconnect();
      setSshTranscript(prev => [result, ...prev]);
      setFeedbackMessage(`SSH command completed in ${result.durationMs} ms.`);
    } catch (err) {
      setFeedbackMessage(
        err instanceof Error ? err.message : 'SSH command execution failed',
      );
    } finally {
      setIsExecutingSsh(false);
    }
  };

  const handleExecuteFullSuite = async () => {
    setIsExecutingSsh(true);
    setFeedbackMessage(`Running full ${vendor.toUpperCase()} SSH diagnostic suite on ${targetIp}...`);
    try {
      const results = await sshClientRef.current.runVendorProfileSuite({
        host: targetIp,
        port: Number.parseInt(sshPort, 10) || 22,
        username: sshUsername,
        password: sshPassword,
        vendor,
      });
      setSshTranscript(prev => [...results, ...prev]);
      setFeedbackMessage(`Completed ${results.length} SSH diagnostic commands on ${targetIp}.`);
    } catch (err) {
      setFeedbackMessage(
        err instanceof Error ? err.message : 'SSH suite execution failed',
      );
    } finally {
      setIsExecutingSsh(false);
    }
  };

  const handleSaveDiagnosticOffline = async () => {
    try {
      const deviceRecord = await StoreRepository.upsertDiscoveredDevice({
        ip: targetIp,
        mac: initialDevice?.mac ?? 'N/A',
        hostname: snmpSummary?.sysName ?? initialDevice?.hostname ?? targetIp,
        vendor: vendor.toUpperCase(),
        services: ['SNMP:161/udp', 'SSH:22/tcp'],
        snmpReachable: Boolean(snmpSummary),
        sshReachable: sshTranscript.length > 0,
        responseTimeMs: snmpSummary?.roundTripTimeMs ?? 10,
        lastSeen: Date.now(),
      });

      const combinedSshText = sshTranscript
        .map(t => `[${t.executedAtIso}] $ ${t.command}\n${t.stdout}`)
        .join('\n\n');

      const { outboxItem } = await outboxManager.recordDiagnosticAndEnqueue({
        deviceId: deviceRecord.id,
        deviceIp: targetIp,
        snmpSummary,
        sshOutput: combinedSshText,
      });

      setFeedbackMessage(
        `Diagnostic persisted to WatermelonDB & enqueued in Outbox (${outboxItem.id}).`,
      );
      syncWorker.processPendingOutbox().catch(() => {});
    } catch (err) {
      setFeedbackMessage(
        err instanceof Error ? err.message : 'Failed to persist diagnostic record',
      );
    }
  };

  const handleProceedToInstallation = () => {
    const combinedSshText = sshTranscript
      .map(t => `[${t.executedAtIso}] $ ${t.command}\n${t.stdout}`)
      .join('\n\n');

    navigation.navigate('Installation', {
      device: initialDevice ?? {
        ip: targetIp,
        mac: 'N/A',
        hostname: snmpSummary?.sysName ?? targetIp,
        vendor: vendor.toUpperCase(),
        services: [],
        snmpReachable: Boolean(snmpSummary),
        sshReachable: sshTranscript.length > 0,
        responseTimeMs: snmpSummary?.roundTripTimeMs ?? 0,
        lastSeen: Date.now(),
      },
      persistedDeviceId: route.params?.persistedDeviceId,
      snmpSummary,
      sshOutput: combinedSshText,
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>SNMP & SSH Console</Text>
          <Text style={styles.screenSubtitle}>UDP/161 ASN.1/BER & SSHv2</Text>
        </View>
        <SyncBadge />
      </View>

      {feedbackMessage && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{feedbackMessage}</Text>
        </View>
      )}

      {/* Target & Zero-Trust Vault Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Target & Hardware Vault Credentials</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Target IPv4</Text>
            <TextInput
              style={styles.input}
              value={targetIp}
              onChangeText={setTargetIp}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.colSmall}>
            <Text style={styles.label}>SNMP Ver</Text>
            <View style={styles.versionToggle}>
              {(['1', '2c'] as SnmpVersion[]).map(ver => (
                <TouchableOpacity
                  key={ver}
                  style={[
                    styles.verBtn,
                    snmpVersion === ver && styles.verBtnActive,
                  ]}
                  onPress={() => setSnmpVersion(ver)}>
                  <Text style={styles.verBtnText}>v{ver}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Community String</Text>
            <TextInput
              style={styles.input}
              value={snmpCommunity}
              onChangeText={setSnmpCommunity}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>SSH Username</Text>
            <TextInput
              style={styles.input}
              value={sshUsername}
              onChangeText={setSshUsername}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>SSH Password</Text>
            <TextInput
              style={styles.input}
              value={sshPassword}
              onChangeText={setSshPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Keystore secret"
              placeholderTextColor="#64748b"
            />
          </View>
          <View style={styles.colSmall}>
            <Text style={styles.label}>SSH Port</Text>
            <TextInput
              style={styles.input}
              value={sshPort}
              onChangeText={setSshPort}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.vaultButton} onPress={handleSaveToVault}>
          <Text style={styles.vaultButtonText}>
            Save Credentials to Hardware Keystore / Keychain
          </Text>
        </TouchableOpacity>
      </View>

      {/* SNMP Binary Telemetry Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>2. SNMP MIB-II Telemetry (UDP/161)</Text>
          <TouchableOpacity
            style={styles.snmpQueryButton}
            disabled={isQueryingSnmp}
            onPress={handleQuerySnmp}>
            {isQueryingSnmp ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.snmpQueryButtonText}>Poll MIB-II OIDs</Text>
            )}
          </TouchableOpacity>
        </View>

        {snmpSummary ? (
          <View style={styles.telemetryBox}>
            <View style={styles.telemetryItem}>
              <Text style={styles.oidKey}>sysName.0 (1.3.6.1.2.1.1.5.0)</Text>
              <Text style={styles.oidVal}>{snmpSummary.sysName}</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.oidKey}>sysUpTime.0 (1.3.6.1.2.1.1.3.0)</Text>
              <Text style={styles.oidVal}>{snmpSummary.sysUpTimeFormatted}</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.oidKey}>sysDescr.0 (1.3.6.1.2.1.1.1.0)</Text>
              <Text style={styles.oidVal}>{snmpSummary.sysDescr}</Text>
            </View>
            <View style={styles.trafficRow}>
              <View style={styles.trafficCounter}>
                <Text style={styles.oidKey}>ifInOctets.1 (0x41 Counter32)</Text>
                <Text style={styles.trafficVal}>
                  {snmpSummary.ifInOctets1.toLocaleString('en-US')} B
                </Text>
              </View>
              <View style={styles.trafficCounter}>
                <Text style={styles.oidKey}>ifOutOctets.1 (0x41 Counter32)</Text>
                <Text style={styles.trafficVal}>
                  {snmpSummary.ifOutOctets1.toLocaleString('en-US')} B
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.mutedHint}>
            Press &quot;Poll MIB-II OIDs&quot; to encode an ASN.1/BER GetRequest PDU and query
            UDP/161 directly.
          </Text>
        )}
      </View>

      {/* SSH Terminal Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Embedded SSHv2 Diagnostic Terminal</Text>
        <TerminalView
          selectedVendor={vendor}
          onSelectVendor={setVendor}
          onExecuteCommand={handleExecuteSshCommand}
          onExecuteFullSuite={handleExecuteFullSuite}
          isExecuting={isExecutingSsh}
          transcript={sshTranscript}
        />
      </View>

      {/* Persistence & Outbox Actions */}
      <View style={styles.footerActions}>
        <TouchableOpacity
          style={styles.persistButton}
          onPress={handleSaveDiagnosticOffline}>
          <Text style={styles.persistButtonText}>
            Save Diagnostic & Enqueue Outbox
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.installNavButton}
          onPress={handleProceedToInstallation}>
          <Text style={styles.installNavButtonText}>
            Attach to Field Installation Order →
          </Text>
        </TouchableOpacity>
      </View>
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
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  col: {
    flex: 1,
  },
  colSmall: {
    width: 82,
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
    paddingVertical: 6,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  versionToggle: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  verBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
  },
  verBtnActive: {
    backgroundColor: '#0284c7',
  },
  verBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  vaultButton: {
    backgroundColor: '#334155',
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  vaultButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  snmpQueryButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  snmpQueryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  telemetryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  telemetryItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 6,
  },
  oidKey: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  oidVal: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  trafficRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  trafficCounter: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 6,
  },
  trafficVal: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  mutedHint: {
    color: '#64748b',
    fontSize: 12,
  },
  footerActions: {
    gap: 10,
    marginTop: 4,
  },
  persistButton: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  persistButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  installNavButton: {
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  installNavButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});

